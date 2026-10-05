// @vitest-environment node

import {
  getRedirectUrl,
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  authorizeRoute,
  normalizeReturnTo,
  resolveSignIn,
  type RouteAuthorizationRequest,
} from "@/features/auth";
import { config, proxy } from "@/proxy";

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

const INVITE_ID = "invite-1";

function session(
  scope: "provisional" | "full_access",
  systemRole: "user" | "admin",
  memberships: Membership[],
  inviteId: string | null = null,
): Backend {
  return () =>
    Response.json({
      scope,
      expiresAt: "2099-01-01T00:15:00.000Z",
      inviteId,
      user: { id: "user-1", email: "ada@campus.local", systemRole },
      memberships,
    });
}

const status =
  (code: number): Backend =>
  () =>
    new Response(null, { status: code });

type FetchDestination = "document" | "empty";
type Destination = RouteAuthorizationRequest | { kind: "sign-in" };

interface Journey {
  shape: string;
  path?: string;
  fetchDest?: FetchDestination;
  cookies: Record<string, string>;
  backend?: Backend;
  route: Destination;
  expected: string;
}

const SHELL: RouteAuthorizationRequest = { kind: "campus-shell" };
const INDEX: RouteAuthorizationRequest = { kind: "campus-index" };
const cohort = (cohortId: string): RouteAuthorizationRequest => ({
  kind: "cohort",
  cohortId,
});
const SIGN_IN: Destination = { kind: "sign-in" };
const INVITATION: RouteAuthorizationRequest = {
  kind: "invitation",
  path: "/invitation",
};
const PREVIEW: RouteAuthorizationRequest = {
  kind: "invitation",
  path: "/preview",
};
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
  {
    shape: "anonymous visitor at sign-in",
    path: "/sign-in?returnTo=%2Fcampus%2Fc-1",
    cookies: {},
    route: SIGN_IN,
    expected: "render",
  },
  {
    shape: "expired access cookie at sign-in",
    path: "/sign-in",
    cookies: SESSION,
    backend: status(401),
    route: SIGN_IN,
    expected: "render",
  },
  {
    shape: "session service outage at sign-in",
    path: "/sign-in",
    cookies: SESSION,
    backend: status(503),
    route: SIGN_IN,
    expected: "render",
  },
  {
    shape: "provisional session with an invite at sign-in",
    path: "/sign-in?returnTo=%2Fpreview",
    cookies: SESSION,
    backend: session("provisional", "user", [], INVITE_ID),
    route: SIGN_IN,
    expected: "redirect /invitation",
  },
  {
    shape: "provisional session without an invite at sign-in",
    path: "/sign-in?error=invite_required",
    cookies: SESSION,
    backend: session("provisional", "user", []),
    route: SIGN_IN,
    expected: "render",
  },
  {
    shape: "full-access member at sign-in with a safe destination",
    path: "/sign-in?returnTo=%2Fcampus%2Fc-1%2Fjoin",
    cookies: SESSION,
    backend: session("full_access", "user", [place("c-1")]),
    route: SIGN_IN,
    expected: "redirect /campus/c-1/join",
  },
  {
    shape: "full-access member at sign-in with an off-site destination",
    path: "/sign-in?returnTo=%2F%2Fevil.example",
    cookies: SESSION,
    backend: session("full_access", "user", [place("c-1")]),
    route: SIGN_IN,
    expected: "redirect /campus",
  },
  {
    shape: "anonymous visitor at the invitation",
    path: "/invitation",
    cookies: {},
    route: INVITATION,
    expected: "redirect /session/refresh?returnTo=%2Finvitation",
  },
  {
    shape: "expired access cookie at the invitation after a refresh",
    path: "/invitation",
    cookies: { ...SESSION, ...MARKER },
    backend: status(401),
    route: INVITATION,
    expected: "redirect /sign-in?returnTo=%2Finvitation",
  },
  {
    shape: "provisional session with an invite at the preview",
    path: "/preview",
    cookies: SESSION,
    backend: session("provisional", "user", [], INVITE_ID),
    route: PREVIEW,
    expected: "allow",
  },
  {
    shape:
      "provisional session with an invite back from Google at the invitation",
    path: "/invitation",
    cookies: SESSION,
    backend: session("provisional", "user", [], INVITE_ID),
    route: INVITATION,
    expected: "redirect /preview",
  },
  {
    shape: "full-access member with an invite at the invitation",
    path: "/invitation",
    cookies: SESSION,
    backend: session("full_access", "user", [place("c-1")], INVITE_ID),
    route: INVITATION,
    expected: "redirect /preview",
  },
  {
    shape: "full-access member without an invite at the invitation",
    path: "/invitation",
    cookies: SESSION,
    backend: session("full_access", "user", [place("c-1")]),
    route: INVITATION,
    expected: "redirect /campus",
  },
  {
    shape: "provisional session without an invite at the invitation",
    path: "/invitation",
    cookies: SESSION,
    backend: session("provisional", "user", []),
    route: INVITATION,
    expected: "redirect /sign-in?error=invite_required",
  },
  {
    shape: "suspended account at the invitation",
    path: "/invitation",
    cookies: SESSION,
    backend: status(403),
    route: INVITATION,
    expected: "forbidden",
  },
  {
    shape: "session service outage at the preview",
    path: "/preview",
    cookies: SESSION,
    backend: status(503),
    route: PREVIEW,
    expected: "unavailable retry /preview",
  },
];

function request(
  path: string,
  cookies: Record<string, string>,
  fetchDestination?: FetchDestination,
): NextRequest {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  return new NextRequest(new URL(path, ORIGIN), {
    headers: {
      ...(cookie && { cookie }),
      ...(fetchDestination && { "sec-fetch-dest": fetchDestination }),
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

function clearsMarker(response: Response): boolean {
  return response.headers
    .getSetCookie()
    .some((cookie) => cookie.startsWith("campus_refresh_attempted=;"));
}

function redirectOutcome(location: string): string {
  const { pathname, search } = new URL(location, ORIGIN);
  return `redirect ${pathname}${search}`;
}

async function decide(destination: Destination, url: URL): Promise<string> {
  const pending =
    destination.kind === "sign-in"
      ? resolveSignIn(url.searchParams.get("returnTo") ?? undefined)
      : authorizeRoute(destination);
  await vi.runAllTimersAsync();
  const decision = await pending;

  switch (decision.kind) {
    case "redirect":
      return redirectOutcome(decision.href);
    case "unavailable":
      return `unavailable retry ${decision.retryHref}`;
    default:
      return decision.kind;
  }
}

interface Visit {
  outcome: string;
  clearedMarker: boolean;
}

// The root proxy runs only where its matcher would: elsewhere the render sees
// the browser's own cookies and no x-campus headers.
async function visit(
  destination: Destination,
  path: string,
  cookies: Record<string, string>,
  fetchDestination?: FetchDestination,
): Promise<Visit> {
  const incoming = request(path, cookies, fetchDestination);
  const proxied = unstable_doesMiddlewareMatch({ config, url: incoming.url })
    ? proxy(incoming)
    : undefined;

  const clearedMarker = proxied !== undefined && clearsMarker(proxied);
  const redirect = proxied && getRedirectUrl(proxied);
  if (redirect) return { outcome: redirectOutcome(redirect), clearedMarker };

  nextHeaders.headers.mockResolvedValue(
    proxied ? headersSeenByRender(proxied) : new Headers(),
  );
  nextHeaders.cookies.mockResolvedValue(incoming.cookies);
  return {
    outcome: await decide(destination, incoming.nextUrl),
    clearedMarker,
  };
}

function stubBackend(backend: Backend | undefined): () => number {
  let calls = 0;
  vi.stubGlobal("fetch", () => {
    calls += 1;
    return Promise.resolve(backend?.() ?? status(500)());
  });
  return () => calls;
}

async function travel(journey: Journey): Promise<{
  outcome: string;
  backendCalls: number;
}> {
  const backendCalls = stubBackend(journey.backend);
  const { outcome } = await visit(
    journey.route,
    journey.path ?? DEEP_LINK,
    journey.cookies,
    journey.fetchDest,
  );
  return { outcome, backendCalls: backendCalls() };
}

const MAX_REDIRECTS = 4;

type RefreshResult = "rejected" | "succeeded";

interface SessionState {
  shape: string;
  cookies: Record<string, string>;
  backend: Backend;
  refresh: RefreshResult;
  backendAfterRefresh?: Backend;
}

const ONE_COHORT = [place("c-1")];

const SESSION_STATES: SessionState[] = [
  {
    shape: "never signed in",
    cookies: {},
    backend: status(401),
    refresh: "rejected",
  },
  {
    shape: "expired, refresh rejected",
    cookies: SESSION,
    backend: status(401),
    refresh: "rejected",
  },
  {
    shape: "expired, refreshed but still signed out",
    cookies: SESSION,
    backend: status(401),
    refresh: "succeeded",
    backendAfterRefresh: status(401),
  },
  {
    shape: "expired, refreshed",
    cookies: SESSION,
    backend: status(401),
    refresh: "succeeded",
    backendAfterRefresh: session("full_access", "user", ONE_COHORT),
  },
  {
    shape: "provisional with an invite",
    cookies: SESSION,
    backend: session("provisional", "user", [], INVITE_ID),
    refresh: "rejected",
  },
  {
    shape: "provisional without an invite",
    cookies: SESSION,
    backend: session("provisional", "user", []),
    refresh: "rejected",
  },
  {
    shape: "full access with an invite",
    cookies: SESSION,
    backend: session("full_access", "user", ONE_COHORT, INVITE_ID),
    refresh: "rejected",
  },
  {
    shape: "full access without an invite",
    cookies: SESSION,
    backend: session("full_access", "user", ONE_COHORT),
    refresh: "rejected",
  },
  {
    shape: "suspended",
    cookies: SESSION,
    backend: status(403),
    refresh: "rejected",
  },
  {
    shape: "session outage",
    cookies: SESSION,
    backend: status(503),
    refresh: "rejected",
  },
];

const ENTRY_URLS = [
  "/campus",
  "/campus/c-1/meeting",
  "/invitation",
  "/preview",
  "/sign-in?returnTo=%2Finvitation",
  "/sign-in?returnTo=%2Fcampus%2Fc-1%2Fmeeting",
];

function destinationOf(pathname: string): Destination | "refresh" {
  if (pathname === "/session/refresh") return "refresh";
  if (pathname === "/sign-in") return SIGN_IN;
  if (pathname === "/invitation") return INVITATION;
  if (pathname === "/preview") return PREVIEW;
  if (pathname === "/campus") return INDEX;

  const [, , cohortSegment = ""] = pathname.split("/");
  return cohort(decodeURIComponent(cohortSegment));
}

interface Chain {
  steps: string[];
  redirects: number;
  revisited: boolean;
}

// Stands in for RefreshSession: a rejected refresh replaces history with
// sign-in; a successful one sets the marker and the rotated access cookie, then
// soft-navigates back.
function refresh(
  url: URL,
  state: SessionState,
  jar: Record<string, string>,
): { next: string; fetchDest: FetchDestination } {
  const returnTo = normalizeReturnTo(
    url.searchParams.get("returnTo") ?? undefined,
  );
  if (state.refresh === "rejected") {
    const search = new URLSearchParams({ returnTo });
    return { next: `/sign-in?${search.toString()}`, fetchDest: "document" };
  }

  Object.assign(jar, SESSION, MARKER);
  stubBackend(state.backendAfterRefresh);
  return { next: returnTo, fetchDest: "empty" };
}

// A redirect keeps the request's kind: the browser follows a document 307 as
// a document load, and the router follows a soft one as another router fetch.
async function walk(entry: string, state: SessionState): Promise<Chain> {
  stubBackend(state.backend);
  const jar = { ...state.cookies };
  const steps = [entry];
  const seen = new Set<string>();
  let path = entry;
  let fetchDestination: FetchDestination = "document";

  for (let redirects = 0; redirects <= MAX_REDIRECTS + 2; redirects += 1) {
    const visitKey = `${path} ${fetchDestination} ${JSON.stringify(jar)}`;
    if (seen.has(visitKey)) return { steps, redirects, revisited: true };
    seen.add(visitKey);

    const url = new URL(path, ORIGIN);
    const destination = destinationOf(url.pathname);
    if (destination === "refresh") {
      ({ next: path, fetchDest: fetchDestination } = refresh(url, state, jar));
      steps.push(path);
      continue;
    }

    const { outcome, clearedMarker } = await visit(
      destination,
      path,
      jar,
      fetchDestination,
    );
    if (clearedMarker) delete jar.campus_refresh_attempted;
    if (!outcome.startsWith("redirect ")) {
      steps.push(outcome);
      return { steps, redirects, revisited: false };
    }

    path = outcome.slice("redirect ".length);
    steps.push(path);
  }

  return { steps, redirects: Infinity, revisited: false };
}

describe(`Auth redirect chain eval (threshold: 0 chains over ${MAX_REDIRECTS} redirects, 0 revisited URLs)`, () => {
  it("ends every journey from every entry route in a rendered page", async () => {
    const failures: string[] = [];
    let chains = 0;

    for (const state of SESSION_STATES) {
      for (const entry of ENTRY_URLS) {
        chains += 1;
        const { steps, redirects, revisited } = await walk(entry, state);
        if (revisited || redirects > MAX_REDIRECTS) {
          failures.push(`${state.shape}: ${steps.join(" -> ")}`);
        }
      }
    }

    expect(failures).toEqual([]);
    expect(chains).toBe(SESSION_STATES.length * ENTRY_URLS.length);
  });

  it("sends an expired invitation session through refresh exactly once before sign-in", async () => {
    const state = SESSION_STATES.find(
      ({ shape }) => shape === "expired, refreshed but still signed out",
    );
    if (!state) throw new Error("missing session state");

    const { steps } = await walk("/invitation", state);

    expect(steps).toEqual([
      "/invitation",
      "/session/refresh?returnTo=%2Finvitation",
      "/invitation",
      "/sign-in?returnTo=%2Finvitation",
      "render",
    ]);
  });
});

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

describe("Campus route protection eval (threshold: 0 mismatched journeys, 0 backend calls without an access cookie)", () => {
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

  it("never calls campus-api for a visitor without an access cookie", async () => {
    const cookieless = JOURNEYS.filter(
      ({ cookies }) => !("campus_session" in cookies),
    );
    const calls: string[] = [];

    for (const journey of cookieless) {
      const { backendCalls } = await travel(journey);
      if (backendCalls > 0) calls.push(`${journey.shape}: ${backendCalls}`);
    }

    expect(calls).toEqual([]);
    expect(cookieless.length).toBeGreaterThan(3);
  });
});
