// @vitest-environment node

import { getRedirectUrl } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  authorizeRoute,
  type RouteAuthorizationRequest,
} from "@/features/auth";
import { proxy } from "@/proxy";

const nextHeaders = vi.hoisted(() => ({ cookies: vi.fn(), headers: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: nextHeaders.cookies,
  headers: nextHeaders.headers,
}));
vi.mock("server-only", () => ({}));

const ORIGIN = "https://campus.example.test";
const DEEP_LINK = "/campus/42?tab=people";
const SESSION = { campus_session: "session-token" };
const MARKER = { campus_refresh_attempted: "1" };

type Membership = { cohortId: string; role: "student"; cohort: object };
type Backend = () => Response;

const place = (cohortId: string): Membership => ({
  cohortId,
  role: "student",
  cohort: { name: cohortId, code: cohortId.toUpperCase() },
});

function session(
  scope: "provisional" | "full_access",
  systemRole: "user" | "admin",
  memberships: Membership[],
): Backend {
  return () =>
    Response.json({
      scope,
      expiresAt: "2099-01-01T00:15:00.000Z",
      user: { id: "user-1", email: "ada@campus.local", systemRole },
      memberships,
    });
}

const status =
  (code: number): Backend =>
  () =>
    new Response(null, { status: code });

interface Journey {
  shape: string;
  path?: string;
  cookies: Record<string, string>;
  backend?: Backend;
  route: RouteAuthorizationRequest["kind"];
  expected: string;
}

const refreshThenReturn = `redirect /session/refresh?returnTo=${encodeURIComponent(DEEP_LINK)}`;
const signInThenReturn = `redirect /sign-in?returnTo=${encodeURIComponent(DEEP_LINK)}`;

const JOURNEYS: Journey[] = [
  {
    shape: "no access cookie",
    cookies: {},
    route: "campus-shell",
    expected: refreshThenReturn,
  },
  {
    shape: "no access cookie after a refresh",
    cookies: MARKER,
    route: "campus-shell",
    expected: signInThenReturn,
  },
  {
    shape: "expired access cookie",
    cookies: SESSION,
    backend: status(401),
    route: "campus-shell",
    expected: refreshThenReturn,
  },
  {
    shape: "expired access cookie after a refresh",
    cookies: { ...SESSION, ...MARKER },
    backend: status(401),
    route: "campus-shell",
    expected: signInThenReturn,
  },
  {
    shape: "provisional session",
    cookies: SESSION,
    backend: session("provisional", "user", []),
    route: "campus-shell",
    expected: "redirect /invitation",
  },
  {
    shape: "full-access member",
    cookies: SESSION,
    backend: session("full_access", "user", [place("c-1")]),
    route: "campus-shell",
    expected: "allow",
  },
  {
    shape: "full-access member with no cohort at the shell",
    cookies: SESSION,
    backend: session("full_access", "user", []),
    route: "campus-shell",
    expected: "allow",
  },
  {
    shape: "suspended account",
    cookies: SESSION,
    backend: status(403),
    route: "campus-shell",
    expected: "forbidden",
  },
  {
    shape: "session service outage",
    cookies: SESSION,
    backend: status(503),
    route: "campus-shell",
    expected: `unavailable retry ${DEEP_LINK}`,
  },
  {
    shape: "malformed session",
    cookies: SESSION,
    backend: () =>
      new Response("<html>", {
        headers: { "content-type": "application/json" },
      }),
    route: "campus-shell",
    expected: `unavailable retry ${DEEP_LINK}`,
  },
  {
    shape: "member with no cohort at the index",
    path: "/campus",
    cookies: SESSION,
    backend: session("full_access", "user", []),
    route: "campus-index",
    expected: "forbidden",
  },
  {
    shape: "member with one cohort at the index",
    path: "/campus",
    cookies: SESSION,
    backend: session("full_access", "user", [place("c-1")]),
    route: "campus-index",
    expected: "redirect /campus/c-1/join",
  },
  {
    shape: "member with two cohorts at the index",
    path: "/campus",
    cookies: SESSION,
    backend: session("full_access", "user", [place("c-1"), place("c-2")]),
    route: "campus-index",
    expected: "allow",
  },
  {
    shape: "admin with no cohort place at the index",
    path: "/campus",
    cookies: SESSION,
    backend: session("full_access", "admin", []),
    route: "campus-index",
    expected: "allow",
  },
  {
    shape: "admin with one cohort place at the index",
    path: "/campus",
    cookies: SESSION,
    backend: session("full_access", "admin", [place("c-1")]),
    route: "campus-index",
    expected: "allow",
  },
];

function requestFor({ path = DEEP_LINK, cookies }: Journey): NextRequest {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  return new NextRequest(new URL(path, ORIGIN), {
    headers: cookie ? { cookie } : {},
  });
}

function headersSeenByRender(response: Response): Headers {
  const names =
    response.headers.get("x-middleware-override-headers")?.split(",") ?? [];
  return new Headers(
    names.map((name) => [
      name,
      response.headers.get(`x-middleware-request-${name}`) ?? "",
    ]),
  );
}

function describeOutcome(
  decision: Awaited<ReturnType<typeof authorizeRoute>>,
): string {
  switch (decision.kind) {
    case "allow":
      return "allow";
    case "forbidden":
      return "forbidden";
    case "redirect":
      return `redirect ${decision.href}`;
    case "unavailable":
      return `unavailable retry ${decision.retryHref}`;
  }
}

async function travel(journey: Journey): Promise<{
  outcome: string;
  backendCalls: number;
}> {
  let backendCalls = 0;
  vi.stubGlobal("fetch", () => {
    backendCalls += 1;
    return Promise.resolve(journey.backend?.() ?? status(500)());
  });

  const request = requestFor(journey);
  const proxied = proxy(request);
  const redirect = getRedirectUrl(proxied);
  if (redirect) {
    const { pathname, search } = new URL(redirect);
    return { outcome: `redirect ${pathname}${search}`, backendCalls };
  }

  nextHeaders.headers.mockResolvedValue(headersSeenByRender(proxied));
  nextHeaders.cookies.mockResolvedValue(request.cookies);
  const decision = authorizeRoute({ kind: journey.route });
  await vi.runAllTimersAsync();
  return { outcome: describeOutcome(await decision), backendCalls };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("API_BASE_URL", "https://api.example.test");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("Campus route protection eval (threshold: 0 mismatched journeys, 0 backend calls from the proxy)", () => {
  it("routes every session and membership shape to exactly its destination", async () => {
    const mismatches: string[] = [];

    for (const journey of JOURNEYS) {
      const { outcome } = await travel(journey);
      if (outcome !== journey.expected) {
        mismatches.push(
          `${journey.shape}: expected "${journey.expected}", got "${outcome}"`,
        );
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("never calls campus-api for a visitor the proxy turns away", async () => {
    const turnedAway = JOURNEYS.filter(
      ({ cookies }) => !("campus_session" in cookies),
    );
    const calls: number[] = [];

    for (const journey of turnedAway) {
      calls.push((await travel(journey)).backendCalls);
    }

    expect(calls.every((count) => count === 0)).toBe(true);
    expect(turnedAway.length).toBeGreaterThan(0);
  });
});
