// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeRoute } from "@/features/auth";

const nextHeaders = vi.hoisted(() => ({ cookies: vi.fn(), headers: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: nextHeaders.cookies,
  headers: nextHeaders.headers,
}));
vi.mock("server-only", () => ({}));

const NOW = Date.parse("2026-10-02T12:00:00.000Z");
const RENDER_BUDGET_MS = 9700;
const RETURN_TO = "/campus/42";

const fullAccessSession = {
  scope: "full_access",
  expiresAt: "2026-10-02T12:15:00.000Z",
  user: { id: "user-1", email: "ada@campus.local", systemRole: "user" },
  memberships: [
    {
      cohortId: "cohort-1",
      role: "student",
      cohort: { name: "C1", code: "C1" },
    },
  ],
};

interface SentRequest {
  path: string;
  clientAddress: string | null;
  sentAtMs: number;
}

type Backend = (request: Request) => Promise<Response>;

function installBackend(answer: Backend): SentRequest[] {
  const sent: SentRequest[] = [];
  vi.stubGlobal("fetch", (request: Request) => {
    sent.push({
      path: new URL(request.url).pathname,
      clientAddress: request.headers.get("x-forwarded-for"),
      sentAtMs: Date.now() - NOW,
    });
    return answer(request);
  });
  return sent;
}

const hangUntilAborted: Backend = (request) =>
  new Promise((_, reject) => {
    request.signal.addEventListener("abort", () =>
      reject(request.signal.reason),
    );
  });

function visitor(clientAddress: string) {
  nextHeaders.cookies.mockResolvedValue({
    get: () => ({ name: "campus_session", value: `token-${clientAddress}` }),
    has: () => false,
  });
  nextHeaders.headers.mockResolvedValue(
    new Headers({
      "x-forwarded-for": clientAddress,
      "x-campus-return-to": RETURN_TO,
    }),
  );
}

async function renderCampusRoute() {
  const decision = authorizeRoute({ kind: "campus-shell" });
  await vi.runAllTimersAsync();
  return decision;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("API_BASE_URL", "https://api.example.test");
  visitor("198.51.100.1");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("Session read resilience eval (threshold: fail closed within 9.7 s, 0 retries before Retry-After, 0 shared rate-limit buckets)", () => {
  it("fails closed within the render budget when campus-api hangs", async () => {
    const sent = installBackend(hangUntilAborted);

    await expect(renderCampusRoute()).resolves.toEqual({
      kind: "unavailable",
      retryHref: RETURN_TO,
    });

    expect(sent).toHaveLength(3);
    expect(Date.now() - NOW).toBeLessThanOrEqual(RENDER_BUDGET_MS);
  });

  it("never asks campus-api again before its Retry-After has passed", async () => {
    const sent = installBackend(() =>
      Promise.resolve(
        new Response(null, { status: 429, headers: { "retry-after": "30" } }),
      ),
    );

    await expect(renderCampusRoute()).resolves.toEqual({
      kind: "unavailable",
      retryHref: RETURN_TO,
      retryAfterMs: 30_000,
    });

    const earlyRetries = sent.filter(
      (request) => request.sentAtMs > 0 && request.sentAtMs < 30_000,
    );
    expect(earlyRetries).toEqual([]);
  });

  it("gives every visitor their own rate-limit bucket at campus-api", async () => {
    const sent = installBackend(() =>
      Promise.resolve(Response.json(fullAccessSession)),
    );

    for (const clientAddress of ["198.51.100.1", "198.51.100.2"]) {
      visitor(clientAddress);
      await expect(renderCampusRoute()).resolves.toMatchObject({
        kind: "allow",
      });
    }

    expect(sent.map((request) => request.clientAddress)).toEqual([
      "198.51.100.1",
      "198.51.100.2",
    ]);
  });
});
