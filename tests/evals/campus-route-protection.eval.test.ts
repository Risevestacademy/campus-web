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
  systemRole: "user" | "admin" | "super_admin",
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

const INDEX: RouteAuthorizationRequest = { kind: "campus-index" };
const SYSTEM_ADMIN: RouteAuthorizationRequest = { kind: "system-admin" };
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
    shape: "full access after campus entry",
    cookies: { ...SESSION, "campus_entry_c-1": "1" },
    backend: session("full_access", "user", ONE_COHORT),
    refresh: "rejected",
  },
  {
    shape: "full-access administrator",
    cookies: SESSION,
    backend: session("full_access", "admin", []),
    refresh: "rejected",
  },
  {
    shape: "full-access Super Administrator",
    cookies: SESSION,
    backend: session("full_access", "super_admin", []),
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
  "/campus/c-1/tracks",
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

  const [, , cohortSegment = "", section] = pathname.split("/");
  if (section === "tracks") return SYSTEM_ADMIN;
  return cohort(decodeURIComponent(cohortSegment));
}

function stateShaped(shape: string): SessionState {
  const state = SESSION_STATES.find((candidate) => candidate.shape === shape);
  if (!state) throw new Error(`missing session state: ${shape}`);
  return state;
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
    const { steps } = await walk(
      "/invitation",
      stateShaped("expired, refreshed but still signed out"),
    );

    expect(steps).toEqual([
      "/invitation",
      "/session/refresh?returnTo=%2Finvitation",
      "/invitation",
      "/sign-in?returnTo=%2Finvitation",
      "render",
    ]);
  });

  it("sends a single-cohort member who already entered straight to their campus", async () => {
    const { steps } = await walk(
      "/campus",
      stateShaped("full access after campus entry"),
    );

    expect(steps).toEqual(["/campus", "/campus/c-1", "allow"]);
  });

  it("forbids an ordinary member from Cohort Track administration", async () => {
    const { steps } = await walk(
      "/campus/c-1/tracks",
      stateShaped("full access without an invite"),
    );

    expect(steps).toEqual(["/campus/c-1/tracks", "forbidden"]);
  });

  it.each(["full-access administrator", "full-access Super Administrator"])(
    "allows a %s into Cohort Track administration",
    async (shape) => {
      const { steps } = await walk("/campus/c-1/tracks", stateShaped(shape));

      expect(steps).toEqual(["/campus/c-1/tracks", "allow"]);
    },
  );
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
