// @vitest-environment node

import { http, HttpResponse } from "msw";
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

import { authorizeRoute, type RouteAuthorizationRequest } from "../index";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const nextHeaders = vi.hoisted(() => ({ cookies: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: nextHeaders.cookies }));
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

const campusShell: RouteAuthorizationRequest = {
  kind: "campus-shell",
  returnTo: "/campus/42/rooms?seat=3#chat",
};

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
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  nextHeaders.cookies.mockReset();
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

    await expect(
      authorize({ kind: "campus-index", returnTo: "/campus" }),
    ).resolves.toEqual({ kind: "redirect", href: "/invitation" });
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

  it("sends an unauthenticated visitor to sign-in once a refresh was attempted", async () => {
    browserCookies({ campus_refresh_attempted: "1" });
    backendReplies(status(401));

    await expect(authorize()).resolves.toEqual({
      kind: "redirect",
      href: "/sign-in?returnTo=%2Fcampus%2F42%2Frooms%3Fseat%3D3",
    });
  });

  it("replaces an unsafe return destination with the campus index", async () => {
    backendReplies(status(401));

    await expect(
      authorize({
        kind: "campus-shell",
        returnTo: "//attacker.example/campus",
      }),
    ).resolves.toEqual({
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

    await expect(authorize()).resolves.toEqual({ kind: "unavailable" });
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

    await expect(authorize()).resolves.toEqual({ kind: "unavailable" });
    expect(sent).toHaveLength(3);
  });

  it.each([408, 429, 500, 502, 503, 504])("retries HTTP %i", async (code) => {
    const sent = backendReplies(status(code), ok(fullAccessSession));

    await expect(authorize()).resolves.toMatchObject({ kind: "allow" });
    expect(sent).toHaveLength(2);
  });

  it.each([400, 404, 409, 422])("does not retry HTTP %i", async (code) => {
    const sent = backendReplies(status(code));

    await expect(authorize()).resolves.toEqual({ kind: "unavailable" });
    expect(sent).toHaveLength(1);
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
    ["a delay is capped at two seconds", "30", 2000],
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

  it("passes the final Retry-After hint to the unavailable state", async () => {
    backendReplies(
      status(503),
      status(503),
      status(503, { "retry-after": "5" }),
    );

    await expect(authorize()).resolves.toEqual({
      kind: "unavailable",
      retryAfterMs: 5000,
    });
  });
});
