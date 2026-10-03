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
  fetchDest?: "document" | "empty";
  cookies: Record<string, string>;
  backend?: Backend;
  route: RouteAuthorizationRequest;
  expected: string;
}

const SHELL: RouteAuthorizationRequest = { kind: "campus-shell" };
const INDEX: RouteAuthorizationRequest = { kind: "campus-index" };
const cohort = (cohortId: string): RouteAuthorizationRequest => ({
  kind: "cohort",
  cohortId,
});
const ACTIVE_DEEP_LINK = "/campus/c-1/meeting?tab=people";
const preJoinOfDeepLink = `redirect /campus/c-1/join?returnTo=${encodeURIComponent(ACTIVE_DEEP_LINK)}`;

const refreshThenReturn = `redirect /session/refresh?returnTo=${encodeURIComponent(DEEP_LINK)}`;
const signInThenReturn = `redirect /sign-in?returnTo=${encodeURIComponent(DEEP_LINK)}`;

const JOURNEYS: Journey[] = [
  {
    shape: "no access cookie",
    cookies: {},
    route: SHELL,
    expected: refreshThenReturn,
  },
  {
    shape: "no access cookie after a refresh",
    cookies: MARKER,
    route: SHELL,
    expected: signInThenReturn,
  },
  {
    shape: "expired access cookie",
    cookies: SESSION,
    backend: status(401),
    route: SHELL,
    expected: refreshThenReturn,
  },
  {
    shape: "expired access cookie after a refresh",
    cookies: { ...SESSION, ...MARKER },
    backend: status(401),
    route: SHELL,
    expected: signInThenReturn,
  },
  {
    shape: "provisional session",
    cookies: SESSION,
    backend: session("provisional", "user", []),
    route: SHELL,
    expected: "redirect /invitation",
  },
  {
    shape: "full-access member",
    cookies: SESSION,
    backend: session("full_access", "user", [place("c-1")]),
    route: SHELL,
    expected: "allow",
  },
  {
    shape: "full-access member with no cohort at the shell",
    cookies: SESSION,
    backend: session("full_access", "user", []),
    route: SHELL,
    expected: "allow",
  },
  {
    shape: "suspended account",
    cookies: SESSION,
    backend: status(403),
    route: SHELL,
    expected: "forbidden",
  },
  {
    shape: "session service outage",
    cookies: SESSION,
    backend: status(503),
    route: SHELL,
    expected: `unavailable retry ${DEEP_LINK}`,
  },
  {
    shape: "malformed session",
    cookies: SESSION,
    backend: () =>
      new Response("<html>", {
        headers: { "content-type": "application/json" },
      }),
    route: SHELL,
    expected: `unavailable retry ${DEEP_LINK}`,
  },
  {
    shape: "member with no cohort at the index",
    path: "/campus",
    cookies: SESSION,
    backend: session("full_access", "user", []),
    route: INDEX,
    expected: "forbidden",
  },
  {
    shape: "member with one cohort at the index",
    path: "/campus",
    cookies: SESSION,
    backend: session("full_access", "user", [place("c-1")]),
    route: INDEX,
    expected: "redirect /campus/c-1/join",
  },
  {
    shape: "member with two cohorts at the index",
    path: "/campus",
    cookies: SESSION,
    backend: session("full_access", "user", [place("c-1"), place("c-2")]),
    route: INDEX,
    expected: "allow",
  },
  {
    shape: "admin with no cohort place at the index",
    path: "/campus",
    cookies: SESSION,
    backend: session("full_access", "admin", []),
    route: INDEX,
    expected: "allow",
  },
  {
    shape: "admin with one cohort place at the index",
    path: "/campus",
    cookies: SESSION,
    backend: session("full_access", "admin", [place("c-1")]),
    route: INDEX,
    expected: "allow",
  },
  {
    shape: "member hard-loads their own active campus",
    path: ACTIVE_DEEP_LINK,
    fetchDest: "document",
    cookies: SESSION,
    backend: session("full_access", "user", [place("c-1")]),
    route: cohort("c-1"),
    expected: preJoinOfDeepLink,
  },
  {
    shape: "signed-out visitor hard-loads an active campus",
    path: ACTIVE_DEEP_LINK,
    fetchDest: "document",
    cookies: {},
    route: cohort("c-1"),
    expected: preJoinOfDeepLink,
  },
  {
    shape: "member soft-navigates inside their own campus",
    path: ACTIVE_DEEP_LINK,
    fetchDest: "empty",
    cookies: SESSION,
    backend: session("full_access", "user", [place("c-1")]),
    route: cohort("c-1"),
    expected: "allow",
  },
  {
    shape: "member opens their own pre-join screen",
    path: "/campus/c-1/join",
    fetchDest: "document",
    cookies: SESSION,
    backend: session("full_access", "user", [place("c-1")]),
    route: cohort("c-1"),
    expected: "allow",
  },
  {
    shape: "member opens another cohort's pre-join screen",
    path: "/campus/c-2/join",
    fetchDest: "document",
    cookies: SESSION,
    backend: session("full_access", "user", [place("c-1")]),
    route: cohort("c-2"),
    expected: "forbidden",
  },
  {
    shape: "member soft-navigates into another cohort",
    path: "/campus/c-2",
    fetchDest: "empty",
    cookies: SESSION,
    backend: session("full_access", "user", [place("c-1")]),
    route: cohort("c-2"),
    expected: "forbidden",
  },
  {
    shape: "admin with no cohort place enters any cohort",
    path: "/campus/c-9",
    fetchDest: "empty",
    cookies: SESSION,
    backend: session("full_access", "admin", []),
    route: cohort("c-9"),
    expected: "allow",
  },
  {
    shape: "provisional session opens a cohort's pre-join screen",
    path: "/campus/c-1/join",
    fetchDest: "document",
    cookies: SESSION,
    backend: session("provisional", "user", []),
    route: cohort("c-1"),
    expected: "redirect /invitation",
  },
];

function requestFor({
  path = DEEP_LINK,
  fetchDest,
  cookies,
}: Journey): NextRequest {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  return new NextRequest(new URL(path, ORIGIN), {
    headers: {
      ...(cookie && { cookie }),
      ...(fetchDest && { "sec-fetch-dest": fetchDest }),
    },
  });
}

function headersSeenByRender(response: Response): Headers {
  const names =
    response.headers.get("x-middleware-override-headers")?.split(",") ?? [];
  return new Headers(
    names.map((name): [string, string] => [
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
  const decision = authorizeRoute(journey.route);
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
