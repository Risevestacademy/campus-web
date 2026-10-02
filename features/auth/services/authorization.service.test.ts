// @vitest-environment node

import { http, HttpResponse } from "msw";
import { getAccessFallbackHTTPStatus } from "next/dist/client/components/http-access-fallback/http-access-fallback";
import {
  getRedirectStatusCodeFromError,
  getURLFromRedirectError,
} from "next/dist/client/components/redirect";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { inOrder, type Reply } from "@/tests/fixtures/mock-api";

import {
  authorizeRoute,
  CampusShellGate,
  requireRouteAccess,
  type RouteAuthorizationRequest,
} from "../index";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const nextHeaders = vi.hoisted(() => ({ cookies: vi.fn(), headers: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: nextHeaders.cookies,
  headers: nextHeaders.headers,
}));
vi.mock("server-only", () => ({}));

const NOW = Date.parse("2026-10-02T12:00:00.000Z");

const fullAccessSession = {
  scope: "full_access",
  expiresAt: "2026-10-02T12:15:00.000Z",
  inviteId: null,
  user: {
    id: "55555555-5555-4555-8555-555555555555",
    email: "ada@campus.local",
    firstName: "Ada",
    lastName: "Lovelace",
    displayName: "Ada Lovelace",
    avatarUrl: "https://lh3.googleusercontent.com/a/example",
    systemRole: "user",
  },
  membership: {
    cohortId: "11111111-1111-4111-8111-111111111111",
    role: "student",
  },
  memberships: [
    {
      cohortId: "11111111-1111-4111-8111-111111111111",
      role: "student",
      cohort: { name: "Cohort 3", code: "C3" },
    },
  ],
};

const provisionalSession = {
  scope: "provisional",
  expiresAt: "2026-10-02T12:15:00.000Z",
  inviteId: "66666666-6666-4666-8666-666666666666",
  user: {
    id: "55555555-5555-4555-8555-555555555555",
    email: "ada@campus.local",
    firstName: null,
    lastName: null,
    displayName: null,
    avatarUrl: null,
    systemRole: "user",
  },
  membership: null,
  memberships: [],
};

const ok =
  (body: unknown): Reply =>
  () =>
    Response.json(body);
const status =
  (code: number, headers?: HeadersInit): Reply =>
  () =>
    new Response(null, { status: code, headers });
const rawBody =
  (body: string): Reply =>
  () =>
    new Response(body, { headers: { "content-type": "application/json" } });
const networkFailure: Reply = () => HttpResponse.error();
const neverAnswers: Reply = () => new Promise<Response>(() => {});

const SESSION_URL = "https://api.example.test/v1/auth/me";

function backendReplies(...replies: Reply[]) {
  mockApi.server.use(http.get(SESSION_URL, inOrder(...replies)));
  return mockApi.requests;
}

const sentAtMs = (requests: typeof mockApi.requests) =>
  requests.map((request) => request.sentAt - NOW);

function browserCookies(values: Record<string, string>) {
  nextHeaders.cookies.mockResolvedValue({
    get: (name: string) =>
      values[name] === undefined ? undefined : { name, value: values[name] },
    has: (name: string) => values[name] !== undefined,
  });
}

const RETURN_TO = "/campus/42/rooms?seat=3";
const UNAVAILABLE = { kind: "unavailable", retryHref: RETURN_TO } as const;

function proxySignals(signals: { returnTo?: string; refreshAttempted?: true }) {
  const headers = new Headers();
  if (signals.returnTo !== undefined) {
    headers.set("x-campus-return-to", signals.returnTo);
  }
  if (signals.refreshAttempted) {
    headers.set("x-campus-refresh-attempted", "1");
  }
  nextHeaders.headers.mockResolvedValue(headers);
}

const campusShell: RouteAuthorizationRequest = { kind: "campus-shell" };
const campusIndex: RouteAuthorizationRequest = { kind: "campus-index" };

const COHORT_A = {
  cohortId: "11111111-1111-4111-8111-111111111111",
  role: "student",
  cohort: { name: "Cohort 3", code: "C3" },
};
const COHORT_B = {
  cohortId: "22222222-2222-4222-8222-222222222222",
  role: "mentor",
  cohort: { name: "Cohort 4", code: "C4" },
};

function fullAccess(
  systemRole: "user" | "admin",
  memberships: readonly object[],
) {
  return {
    ...fullAccessSession,
    user: { ...fullAccessSession.user, systemRole },
    membership: null,
    memberships,
  };
}

async function authorize(request = campusShell) {
  const decision = authorizeRoute(request);
  await vi.runAllTimersAsync();
  return decision;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("API_BASE_URL", "https://api.example.test");
  browserCookies({ campus_session: "session-token" });
  proxySignals({ returnTo: RETURN_TO });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  nextHeaders.cookies.mockReset();
  nextHeaders.headers.mockReset();
  mockApi.reset();
});

afterAll(() => {
  mockApi.close();
});

describe("authorizeRoute: signed-in sessions", () => {
  it("allows a full-access session and returns every session field", async () => {
    backendReplies(ok(fullAccessSession));

    await expect(authorize()).resolves.toEqual({
      kind: "allow",
      session: fullAccessSession,
    });
  });

  it("asks the backend directly with only the request's session cookie", async () => {
    browserCookies({ campus_session: "session-token", theme: "dark" });
    const sent = backendReplies(ok(fullAccessSession));

    await authorize();

    expect(sent).toEqual([
      {
        method: "GET",
        url: SESSION_URL,
        cookie: "campus_session=session-token",
        sentAt: NOW,
      },
    ]);
  });

  it("sends a provisional session to its invitation", async () => {
    backendReplies(ok(provisionalSession));

    await expect(authorize()).resolves.toEqual({
      kind: "redirect",
      href: "/invitation",
    });
  });

  it("applies the same policy to the campus index", async () => {
    backendReplies(ok(provisionalSession));

    await expect(authorize(campusIndex)).resolves.toEqual({
      kind: "redirect",
      href: "/invitation",
    });
  });
});

describe("authorizeRoute: signed-out and refused sessions", () => {
  it("sends an unauthenticated visitor through one refresh attempt", async () => {
    const sent = backendReplies(status(401));

    await expect(authorize()).resolves.toEqual({
      kind: "redirect",
      href: "/session/refresh?returnTo=%2Fcampus%2F42%2Frooms%3Fseat%3D3",
    });
    expect(sent).toHaveLength(1);
  });

  it("sends an unauthenticated visitor to sign-in once the proxy reports a refresh attempt", async () => {
    proxySignals({ returnTo: RETURN_TO, refreshAttempted: true });
    backendReplies(status(401));

    await expect(authorize()).resolves.toEqual({
      kind: "redirect",
      href: "/sign-in?returnTo=%2Fcampus%2F42%2Frooms%3Fseat%3D3",
    });
  });

  it("trusts the proxy's refresh signal, not the marker cookie the proxy clears", async () => {
    browserCookies({
      campus_session: "session-token",
      campus_refresh_attempted: "1",
    });
    backendReplies(status(401));

    await expect(authorize()).resolves.toEqual({
      kind: "redirect",
      href: "/session/refresh?returnTo=%2Fcampus%2F42%2Frooms%3Fseat%3D3",
    });
  });

  it("replaces an unsafe return destination with the campus index", async () => {
    proxySignals({ returnTo: "//attacker.example/campus" });
    backendReplies(status(401));

    await expect(authorize()).resolves.toEqual({
      kind: "redirect",
      href: "/session/refresh?returnTo=%2Fcampus",
    });
  });

  it("returns to the campus index when the proxy sent no return path", async () => {
    proxySignals({});
    backendReplies(status(401));

    await expect(authorize()).resolves.toEqual({
      kind: "redirect",
      href: "/session/refresh?returnTo=%2Fcampus",
    });
  });

  it("forbids an account the backend refuses, without retrying", async () => {
    const sent = backendReplies(status(403));

    await expect(authorize()).resolves.toEqual({ kind: "forbidden" });
    expect(sent).toHaveLength(1);
  });
});

describe("authorizeRoute: malformed sessions", () => {
  it.each([
    ["invalid JSON", rawBody("{not json")],
    ["an HTML error page", rawBody("<html>bad gateway</html>")],
    ["an empty body", rawBody("")],
    ["an unknown scope", ok({ ...fullAccessSession, scope: "root" })],
    ["a missing user", ok({ ...fullAccessSession, user: undefined })],
    [
      "a user without a system role",
      ok({ ...fullAccessSession, user: { id: "u", email: "e" } }),
    ],
    [
      "memberships that are not a list",
      ok({ ...fullAccessSession, memberships: null }),
    ],
    ["an invalid expiry", ok({ ...fullAccessSession, expiresAt: "tomorrow" })],
  ])("fails closed on %s instead of reporting a sign-out", async (_, reply) => {
    const sent = backendReplies(reply);

    await expect(authorize()).resolves.toEqual(UNAVAILABLE);
    expect(sent).toHaveLength(1);
  });
});

describe("authorizeRoute: transient outages", () => {
  it("retries after 200 ms and then 500 ms before recovering", async () => {
    const sent = backendReplies(
      networkFailure,
      status(503),
      ok(fullAccessSession),
    );

    await expect(authorize()).resolves.toMatchObject({ kind: "allow" });
    expect(sentAtMs(sent)).toEqual([0, 200, 700]);
  });

  it("fails closed after three attempts", async () => {
    const sent = backendReplies(networkFailure, networkFailure, networkFailure);

    await expect(authorize()).resolves.toEqual(UNAVAILABLE);
    expect(sent).toHaveLength(3);
  });

  it.each([408, 429, 500, 502, 503, 504])("retries HTTP %i", async (code) => {
    const sent = backendReplies(status(code), ok(fullAccessSession));

    await expect(authorize()).resolves.toMatchObject({ kind: "allow" });
    expect(sent).toHaveLength(2);
  });

  it.each([400, 404, 409, 422])("does not retry HTTP %i", async (code) => {
    const sent = backendReplies(status(code));

    await expect(authorize()).resolves.toEqual(UNAVAILABLE);
    expect(sent).toHaveLength(1);
  });

  it("abandons an attempt the backend leaves unanswered for 3 s and retries", async () => {
    const sent = backendReplies(neverAnswers, ok(fullAccessSession));

    await expect(authorize()).resolves.toMatchObject({ kind: "allow" });
    expect(sentAtMs(sent)).toEqual([0, 3200]);
  });

  it("fails closed within 9.7 s when the backend never answers", async () => {
    const sent = backendReplies(neverAnswers, neverAnswers, neverAnswers);

    await expect(authorize()).resolves.toEqual(UNAVAILABLE);
    expect(sentAtMs(sent)).toEqual([0, 3200, 6700]);
    expect(Date.now() - NOW).toBe(9700);
  });

  it("opts every attempt out of Next's per-render fetch dedupe so retries reach the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    backendReplies(status(503), status(503), ok(fullAccessSession));

    await authorize();

    const signals = fetchSpy.mock.calls.map(([, init]) => init?.signal);
    expect(signals).toHaveLength(3);
    expect(signals.every((signal) => signal instanceof AbortSignal)).toBe(true);
    expect(new Set(signals).size).toBe(3);
    fetchSpy.mockRestore();
  });

  it("stops retrying once the backend answers that the visitor is signed out", async () => {
    const sent = backendReplies(status(503), status(401));

    await expect(authorize()).resolves.toMatchObject({ kind: "redirect" });
    expect(sent).toHaveLength(2);
  });
});

describe("authorizeRoute: Retry-After", () => {
  it.each([
    ["a longer delay extends the wait", "1", 1000],
    ["a two-second delay is honoured in full", "2", 2000],
    ["a shorter delay keeps the backoff", "0", 200],
    ["an HTTP date is honoured", "Fri, 02 Oct 2026 12:00:01 GMT", 1000],
    ["an unreadable value is ignored", "soon", 200],
    ["a fractional value is ignored", "1.5", 200],
  ])("%s", async (_, retryAfter, expectedSecondRequestMs) => {
    const sent = backendReplies(
      status(429, { "retry-after": retryAfter }),
      ok(fullAccessSession),
    );

    await authorize();

    expect(sentAtMs(sent)).toEqual([0, expectedSecondRequestMs]);
  });

  it.each([
    ["seconds", "30", 30_000],
    ["an HTTP date", "Fri, 02 Oct 2026 12:00:30 GMT", 30_000],
  ])(
    "fails closed without retrying early when Retry-After (%s) asks for more than two seconds",
    async (_, retryAfter, retryAfterMs) => {
      const sent = backendReplies(status(503, { "retry-after": retryAfter }));

      await expect(authorize()).resolves.toEqual({
        ...UNAVAILABLE,
        retryAfterMs,
      });
      expect(sent).toHaveLength(1);
    },
  );

  it("passes the final Retry-After hint to the unavailable state", async () => {
    backendReplies(
      status(503),
      status(503),
      status(503, { "retry-after": "5" }),
    );

    await expect(authorize()).resolves.toEqual({
      ...UNAVAILABLE,
      retryAfterMs: 5000,
    });
  });
});

describe("authorizeRoute: outage retry destination", () => {
  it("offers a retry of the sanitized path the visitor asked for", async () => {
    proxySignals({ returnTo: "//attacker.example/campus" });
    backendReplies(status(503), status(503), status(503));

    await expect(authorize()).resolves.toEqual({
      kind: "unavailable",
      retryHref: "/campus",
    });
  });
});

describe("authorizeRoute: campus index membership routing", () => {
  it("lets a member with several cohorts choose between them", async () => {
    const session = fullAccess("user", [COHORT_A, COHORT_B]);
    backendReplies(ok(session));

    await expect(authorize(campusIndex)).resolves.toEqual({
      kind: "allow",
      session,
    });
  });

  it("sends a member with one cohort straight to its pre-join screen", async () => {
    backendReplies(ok(fullAccess("user", [COHORT_A])));

    await expect(authorize(campusIndex)).resolves.toEqual({
      kind: "redirect",
      href: "/campus/11111111-1111-4111-8111-111111111111/join",
    });
  });

  it("encodes the cohort ID into a single path segment", async () => {
    backendReplies(
      ok(fullAccess("user", [{ ...COHORT_A, cohortId: "a/b c?d" }])),
    );

    await expect(authorize(campusIndex)).resolves.toEqual({
      kind: "redirect",
      href: "/campus/a%2Fb%20c%3Fd/join",
    });
  });

  it("forbids a member who belongs to no cohort", async () => {
    backendReplies(ok(fullAccess("user", [])));

    await expect(authorize(campusIndex)).resolves.toEqual({
      kind: "forbidden",
    });
  });

  it("lets an admin with no cohort place choose from every cohort", async () => {
    const session = fullAccess("admin", []);
    backendReplies(ok(session));

    await expect(authorize(campusIndex)).resolves.toEqual({
      kind: "allow",
      session,
    });
  });

  it("does not redirect an admin who holds a single cohort place", async () => {
    const session = fullAccess("admin", [COHORT_A]);
    backendReplies(ok(session));

    await expect(authorize(campusIndex)).resolves.toEqual({
      kind: "allow",
      session,
    });
  });

  it("keeps membership routing out of the campus shell", async () => {
    const session = fullAccess("user", []);
    backendReplies(ok(session));

    await expect(authorize(campusShell)).resolves.toEqual({
      kind: "allow",
      session,
    });
  });
});

async function settle<T>(pending: Promise<T>): Promise<T | unknown> {
  const outcome = pending.catch((error: unknown) => error);
  await vi.runAllTimersAsync();
  return outcome;
}

describe("requireRouteAccess", () => {
  beforeEach(() => {
    vi.stubEnv("__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS", "true");
  });

  it("returns the session for a visitor who may render the route", async () => {
    backendReplies(ok(fullAccessSession));

    await expect(settle(requireRouteAccess(campusShell))).resolves.toEqual({
      kind: "allow",
      session: fullAccessSession,
    });
  });

  it("interrupts the render with a temporary redirect to the decided destination", async () => {
    backendReplies(ok(provisionalSession));

    const interrupt = await settle(requireRouteAccess(campusShell));

    expect(isRedirectError(interrupt)).toBe(true);
    if (!isRedirectError(interrupt)) return;
    expect(getURLFromRedirectError(interrupt)).toBe("/invitation");
    expect(getRedirectStatusCodeFromError(interrupt)).toBe(307);
  });

  it("interrupts the render with a 403 for a refused account", async () => {
    backendReplies(status(403));

    const interrupt = await settle(requireRouteAccess(campusShell));

    expect(getAccessFallbackHTTPStatus(interrupt as never)).toBe(403);
  });

  it("returns the retry destination when the session service is down", async () => {
    backendReplies(status(503), status(503), status(503));

    await expect(settle(requireRouteAccess(campusShell))).resolves.toEqual(
      UNAVAILABLE,
    );
  });
});

describe("CampusShellGate", () => {
  const campusContent = createElement("p", null, "Campus content");

  async function renderGate() {
    const element = await settle(CampusShellGate({ children: campusContent }));
    return renderToStaticMarkup(element as ReactElement);
  }

  it("renders the route for a full-access visitor", async () => {
    backendReplies(ok(fullAccessSession));

    await expect(renderGate()).resolves.toBe("<p>Campus content</p>");
  });

  it("renders the retry state instead of the route during an outage", async () => {
    backendReplies(status(503), status(503), status(503));

    const markup = await renderGate();

    expect(markup).not.toContain("Campus content");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain(`href="${RETURN_TO}"`);
  });
});
