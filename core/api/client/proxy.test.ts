// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import type { Logger } from "@/core/observability";

import { createApiProxy } from "./proxy";

vi.mock("server-only", () => ({}));

const quietLogger: Logger = {
  error: () => {},
  info: () => {},
  warn: () => {},
};

const rejectEveryReturnTo = () => undefined;
const keepReturnTo = (value: string | undefined) => value;
const sanitizeRawReturnTo = (value: string | undefined) =>
  value === "/raw" ? "/sanitized" : undefined;

const baseOptions = {
  baseUrl: "https://api.example.test",
  logger: quietLogger,
  parseReturnTo: rejectEveryReturnTo,
};

describe("createApiProxy", () => {
  it("transparently forwards an authenticated backend response", async () => {
    let outboundRequest: Request | undefined;
    const responseBody = {
      status: "ok",
      timestamp: "2026-09-10T00:00:00.000Z",
    };
    const handler = createApiProxy({
      ...baseOptions,
      fetch: (request) => {
        outboundRequest = request;
        return Promise.resolve(
          Response.json(responseBody, {
            headers: {
              "cache-control": "public, max-age=3600",
              etag: '"health-1"',
              expires: "Wed, 21 Oct 2026 07:28:00 GMT",
            },
          }),
        );
      },
    });
    const request = new Request(
      "https://frontend.example.test/api/v1/health?verbose=true",
      {
        headers: {
          accept: "application/json",
          cookie: "campus_session=session-token; theme=dark",
          origin: "https://frontend.example.test",
          "x-forwarded-for": "203.0.113.10",
          "x-untrusted-header": "must-not-be-forwarded",
        },
      },
    );

    const response = await handler(request, {
      params: Promise.resolve({ path: ["v1", "health"] }),
    });

    expect(outboundRequest?.url).toBe(
      "https://api.example.test/v1/health?verbose=true",
    );
    expect(outboundRequest?.headers.get("cookie")).toBe(
      "campus_session=session-token",
    );
    expect(outboundRequest?.headers.get("x-forwarded-for")).toBe(
      "203.0.113.10",
    );
    expect(outboundRequest?.headers.has("x-untrusted-header")).toBe(false);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("expires")).toBeNull();
    expect(response.headers.get("etag")).toBe('"health-1"');
    expect(await response.json()).toEqual(responseBody);
  });

  it("preserves backend cache policy for anonymous responses", async () => {
    const handler = createApiProxy({
      ...baseOptions,
      fetch: () =>
        Promise.resolve(
          Response.json(
            { status: "ok" },
            {
              headers: {
                "cache-control": "public, max-age=60",
              },
            },
          ),
        ),
    });

    const response = await handler(
      new Request("https://frontend.example.test/api/v1/health", {
        headers: { origin: "https://frontend.example.test" },
      }),
      { params: Promise.resolve({ path: ["v1", "health"] }) },
    );

    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
  });

  it("streams an unsafe request body to the backend", async () => {
    let outboundBody: string | undefined;
    const handler = createApiProxy({
      ...baseOptions,
      fetch: async (request) => {
        outboundBody = await request.text();
        return new Response(null, { status: 204 });
      },
    });
    const request = new Request(
      "https://frontend.example.test/api/v1/profile",
      {
        body: JSON.stringify({ displayName: "Ada" }),
        headers: {
          "content-type": "application/json",
          cookie: "campus_session=session-token",
          origin: "https://frontend.example.test",
          "x-forwarded-host": "frontend.example.test",
          "x-forwarded-proto": "https",
        },
        method: "PATCH",
      },
    );

    const response = await handler(request, {
      params: Promise.resolve({ path: ["v1", "profile"] }),
    });

    expect(response.status).toBe(204);
    expect(outboundBody).toBe('{"displayName":"Ada"}');
  });

  it("rejects a cross-origin unsafe request before contacting the backend", async () => {
    let upstreamCalls = 0;
    const records: Array<{
      event: string;
      fields: Parameters<Logger["warn"]>[1];
    }> = [];
    const logger: Logger = {
      error: () => {},
      info: () => {},
      warn: (event, fields) => records.push({ event, fields }),
    };
    const handler = createApiProxy({
      ...baseOptions,
      clock: () => 200,
      generateRequestId: () => "proxy-request-csrf",
      logger,
      fetch: () => {
        upstreamCalls += 1;
        return Promise.resolve(new Response(null, { status: 204 }));
      },
    });
    const request = new Request(
      "https://frontend.example.test/api/v1/profile",
      {
        body: JSON.stringify({ displayName: "Mallory" }),
        headers: {
          "content-type": "application/json",
          cookie: "campus_session=session-token",
          origin: "https://attacker.example",
          "x-forwarded-host": "frontend.example.test",
          "x-forwarded-proto": "https",
        },
        method: "PATCH",
      },
    );

    const response = await handler(request, {
      params: Promise.resolve({ path: ["v1", "profile"] }),
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("x-request-id")).toBe("proxy-request-csrf");
    expect(await response.json()).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Cross-origin request rejected.",
      },
    });
    expect(upstreamCalls).toBe(0);
    expect(records).toEqual([
      {
        event: "api.proxy.rejected",
        fields: {
          durationMs: 0,
          errorCode: "cross_origin",
          method: "PATCH",
          requestId: "proxy-request-csrf",
          route: "/v1/profile",
          status: 403,
        },
      },
    ]);
  });

  it("sanitizes an upstream failure while preserving correlated diagnostics", async () => {
    const records: Array<{
      event: string;
      fields: Parameters<Logger["error"]>[1];
    }> = [];
    const logger: Logger = {
      error: (event, fields) => records.push({ event, fields }),
      info: () => {},
      warn: () => {},
    };
    const handler = createApiProxy({
      ...baseOptions,
      clock: () => 125,
      generateRequestId: () => "proxy-request-1",
      logger,
      fetch: () => {
        throw new TypeError("sensitive upstream connection detail");
      },
    });

    const response = await handler(
      new Request("https://frontend.example.test/api/v1/health", {
        headers: { origin: "https://frontend.example.test" },
      }),
      { params: Promise.resolve({ path: ["v1", "health"] }) },
    );
    const responseText = await response.text();

    expect(response.status).toBe(502);
    expect(response.headers.get("x-request-id")).toBe("proxy-request-1");
    expect(responseText).toBe(
      '{"error":{"code":"INTERNAL_ERROR","message":"API is unavailable."}}',
    );
    expect(responseText).not.toContain("sensitive upstream connection detail");
    expect(records).toEqual([
      {
        event: "api.proxy.failed",
        fields: {
          durationMs: 0,
          errorName: "TypeError",
          method: "GET",
          requestId: "proxy-request-1",
          route: "/v1/health",
          status: 502,
        },
      },
    ]);
  });

  it("correlates a successful request across the backend, response, and log", async () => {
    const records: Array<{
      event: string;
      fields: Parameters<Logger["info"]>[1];
    }> = [];
    const logger: Logger = {
      error: () => {},
      info: (event, fields) => records.push({ event, fields }),
      warn: () => {},
    };
    const timestamps = [100, 125];
    let outboundRequest: Request | undefined;
    const handler = createApiProxy({
      ...baseOptions,
      clock: () => timestamps.shift() ?? 125,
      generateRequestId: () => "proxy-request-2",
      logger,
      fetch: (request) => {
        outboundRequest = request;
        return Promise.resolve(Response.json({ status: "ok" }));
      },
    });

    const response = await handler(
      new Request("https://frontend.example.test/api/v1/health", {
        headers: { origin: "https://frontend.example.test" },
      }),
      { params: Promise.resolve({ path: ["v1", "health"] }) },
    );

    expect(outboundRequest?.headers.get("x-request-id")).toBe(
      "proxy-request-2",
    );
    expect(response.headers.get("x-request-id")).toBe("proxy-request-2");
    expect(records).toEqual([
      {
        event: "api.proxy.completed",
        fields: {
          durationMs: 25,
          method: "GET",
          requestId: "proxy-request-2",
          route: "/v1/health",
          status: 200,
        },
      },
    ]);
  });

  it("returns only normalized backend authentication cookies", async () => {
    const upstreamHeaders = new Headers({
      "content-type": "application/json",
    });
    upstreamHeaders.append(
      "set-cookie",
      "theme=dark; Domain=api.example.test; Path=/v1",
    );
    upstreamHeaders.append(
      "set-cookie",
      "campus_session=renewed; Domain=.example.test; Path=/v1",
    );
    upstreamHeaders.append(
      "set-cookie",
      "campus_refresh=refresh-token; Domain=api.example.test; Path=/v1/auth",
    );
    upstreamHeaders.append(
      "set-cookie",
      "campus_oauth_state=state-token; Path=/v1/auth",
    );
    const handler = createApiProxy({
      ...baseOptions,
      fetch: () =>
        Promise.resolve(
          new Response("{}", { headers: upstreamHeaders, status: 200 }),
        ),
    });

    const response = await handler(
      new Request("https://frontend.example.test/api/v1/session", {
        headers: { origin: "https://frontend.example.test" },
      }),
      { params: Promise.resolve({ path: ["v1", "session"] }) },
    );

    expect(response.headers.getSetCookie()).toEqual([
      "campus_session=renewed; Domain=.example.test; HttpOnly; Secure; SameSite=Lax; Path=/",
      "campus_refresh=refresh-token; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth",
      "campus_oauth_state=state-token; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth",
    ]);
  });

  it("keeps local HTTP cookies usable while enforcing browser isolation", async () => {
    const upstreamHeaders = new Headers();
    upstreamHeaders.append("set-cookie", "campus_session=renewed; Path=/v1");
    const handler = createApiProxy({
      ...baseOptions,
      fetch: () =>
        Promise.resolve(new Response("{}", { headers: upstreamHeaders })),
    });

    const response = await handler(
      new Request("http://localhost:3000/api/v1/session", {
        headers: { origin: "http://localhost:3000" },
      }),
      { params: Promise.resolve({ path: ["v1", "session"] }) },
    );

    expect(response.headers.getSetCookie()).toEqual([
      "campus_session=renewed; HttpOnly; SameSite=Lax; Path=/",
    ]);
  });

  it("preserves a redirect without following it on the server", async () => {
    let redirectMode: RequestRedirect | undefined;
    const handler = createApiProxy({
      ...baseOptions,
      fetch: (request) => {
        redirectMode = request.redirect;
        return Promise.resolve(
          new Response(null, {
            headers: { location: "https://attacker.example/collect" },
            status: 307,
          }),
        );
      },
    });

    const response = await handler(
      new Request("https://frontend.example.test/api/v1/profile", {
        headers: {
          cookie: "campus_session=session-token",
          origin: "https://frontend.example.test",
        },
      }),
      { params: Promise.resolve({ path: ["v1", "profile"] }) },
    );

    expect(redirectMode).toBe("manual");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://attacker.example/collect",
    );
  });

  it("starts Google OAuth with backend state and the parsed frontend return destination", async () => {
    let outboundRequest: Request | undefined;
    const headers = new Headers({
      location: "https://accounts.google.com/o/oauth2/v2/auth",
    });
    headers.append(
      "set-cookie",
      "campus_oauth_state=oauth-state; Path=/v1/auth; HttpOnly; Secure",
    );
    const handler = createApiProxy({
      ...baseOptions,
      parseReturnTo: keepReturnTo,
      fetch: (request) => {
        outboundRequest = request;
        return Promise.resolve(new Response(null, { headers, status: 302 }));
      },
    });

    const response = await handler(
      new Request(
        "https://frontend.example.test/api/v1/auth/google?returnTo=%2Fcampus%2F42%2Fjoin",
      ),
      { params: Promise.resolve({ path: ["v1", "auth", "google"] }) },
    );

    expect(outboundRequest?.url).toBe(
      "https://api.example.test/v1/auth/google",
    );
    expect(outboundRequest?.redirect).toBe("manual");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(response.headers.getSetCookie()).toEqual([
      "campus_oauth_state=oauth-state; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth",
      "campus_oauth_return_to=%2Fcampus%2F42%2Fjoin; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=600",
    ]);
  });

  describe("OAuth return destinations", () => {
    const googleRedirect = () =>
      Promise.resolve(
        new Response(null, {
          headers: { location: "https://accounts.google.com/o/oauth2/v2/auth" },
          status: 302,
        }),
      );
    const frontendRootRedirect = () =>
      Promise.resolve(
        new Response(null, {
          headers: { location: "https://frontend.example.test/" },
          status: 302,
        }),
      );

    function startOauth(
      returnTo: string,
      parseReturnTo: (value: string | undefined) => string | undefined,
    ) {
      const handler = createApiProxy({
        ...baseOptions,
        parseReturnTo,
        fetch: googleRedirect,
      });
      const search = new URLSearchParams({ returnTo });

      return handler(
        new Request(
          `https://frontend.example.test/api/v1/auth/google?${search.toString()}`,
        ),
        { params: Promise.resolve({ path: ["v1", "auth", "google"] }) },
      );
    }

    function completeOauth(
      storedReturnTo: string,
      parseReturnTo: (value: string | undefined) => string | undefined,
    ) {
      const handler = createApiProxy({
        ...baseOptions,
        parseReturnTo,
        fetch: frontendRootRedirect,
      });

      return handler(
        new Request(
          "https://frontend.example.test/api/v1/auth/google/callback?code=google-code",
          {
            headers: {
              cookie: `campus_oauth_state=oauth-state; campus_oauth_return_to=${encodeURIComponent(storedReturnTo)}`,
            },
          },
        ),
        {
          params: Promise.resolve({
            path: ["v1", "auth", "google", "callback"],
          }),
        },
      );
    }

    it("stores the destination the injected policy returns, not the raw value", async () => {
      const response = await startOauth("/raw", sanitizeRawReturnTo);

      expect(response.headers.getSetCookie()).toContain(
        "campus_oauth_return_to=%2Fsanitized; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=600",
      );
    });

    it("clears the return cookie when the injected policy rejects the destination", async () => {
      const response = await startOauth("/campus/42/join", rejectEveryReturnTo);

      expect(response.headers.getSetCookie()).toContain(
        "campus_oauth_return_to=; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=0",
      );
    });

    it("re-checks the stored destination through the injected policy on callback", async () => {
      const response = await completeOauth("/raw", sanitizeRawReturnTo);

      expect(response.headers.get("location")).toBe(
        "https://frontend.example.test/sanitized",
      );
    });

    it("falls back to the campus index when the stored destination is rejected", async () => {
      const response = await completeOauth(
        "/campus/42/join",
        rejectEveryReturnTo,
      );

      expect(response.headers.get("location")).toBe(
        "https://frontend.example.test/campus",
      );
    });
  });

  it("rewrites a successful OAuth callback to the stored destination", async () => {
    let outboundCookie: string | null | undefined;
    const handler = createApiProxy({
      ...baseOptions,
      parseReturnTo: keepReturnTo,
      fetch: (request) => {
        outboundCookie = request.headers.get("cookie");
        return Promise.resolve(
          new Response(null, {
            headers: {
              location: "https://frontend.example.test/",
            },
            status: 302,
          }),
        );
      },
    });

    const response = await handler(
      new Request(
        "https://frontend.example.test/api/v1/auth/google/callback?code=google-code",
        {
          headers: {
            cookie:
              "campus_oauth_state=oauth-state; campus_oauth_return_to=%2Fcampus%2F42%2Fjoin; theme=dark",
          },
        },
      ),
      {
        params: Promise.resolve({
          path: ["v1", "auth", "google", "callback"],
        }),
      },
    );

    expect(outboundCookie).toBe("campus_oauth_state=oauth-state");
    expect(response.headers.get("location")).toBe(
      "https://frontend.example.test/campus/42/join",
    );
    expect(response.headers.getSetCookie()).toContain(
      "campus_oauth_return_to=; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=0",
    );
  });

  it.each([
    "https://frontend.example.test/invitation",
    "https://frontend.example.test/sign-in?error=denied",
    "https://unexpected.example.test/elsewhere",
  ])("preserves the backend callback destination %s", async (location) => {
    const handler = createApiProxy({
      ...baseOptions,
      fetch: () =>
        Promise.resolve(
          new Response(null, {
            headers: { location },
            status: 302,
          }),
        ),
    });

    const response = await handler(
      new Request("https://frontend.example.test/api/v1/auth/google/callback", {
        headers: {
          cookie:
            "campus_oauth_return_to=%2Fcampus%2F42%2Fjoin; campus_oauth_state=oauth-state",
        },
      }),
      {
        params: Promise.resolve({
          path: ["v1", "auth", "google", "callback"],
        }),
      },
    );

    expect(response.headers.get("location")).toBe(location);
    expect(response.headers.getSetCookie()).toContain(
      "campus_oauth_return_to=; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=0",
    );
  });

  it("preserves conditional request and rate-limit response metadata", async () => {
    let outboundRequest: Request | undefined;
    const handler = createApiProxy({
      ...baseOptions,
      fetch: (request) => {
        outboundRequest = request;
        return Promise.resolve(
          new Response(null, {
            headers: {
              etag: '"health-2"',
              "ratelimit-policy": "100;w=60",
              "ratelimit-remaining": "42",
            },
            status: 304,
          }),
        );
      },
    });
    const request = new Request("https://frontend.example.test/api/v1/health", {
      headers: {
        "if-none-match": '"health-1"',
        origin: "https://frontend.example.test",
      },
    });

    const response = await handler(request, {
      params: Promise.resolve({ path: ["v1", "health"] }),
    });

    expect(outboundRequest?.headers.get("if-none-match")).toBe('"health-1"');
    expect(response.headers.get("etag")).toBe('"health-2"');
    expect(response.headers.get("ratelimit-policy")).toBe("100;w=60");
    expect(response.headers.get("ratelimit-remaining")).toBe("42");
  });
});

describe("createApiProxy refresh-attempt marker", () => {
  function refreshThrough(
    upstream: Response,
    frontendOrigin = "https://frontend.example.test",
  ) {
    const handler = createApiProxy({
      ...baseOptions,
      fetch: () => Promise.resolve(upstream),
    });

    return handler(
      new Request(`${frontendOrigin}/api/v1/auth/refresh`, {
        method: "POST",
        headers: {
          origin: frontendOrigin,
          "x-forwarded-host": new URL(frontendOrigin).host,
          "x-forwarded-proto": new URL(frontendOrigin).protocol.slice(0, -1),
        },
      }),
      { params: Promise.resolve({ path: ["v1", "auth", "refresh"] }) },
    );
  }

  const refreshed = () =>
    Response.json({
      expiresAt: "2026-10-02T12:15:00.000Z",
      refreshExpiresAt: "2026-11-01T12:00:00.000Z",
    });

  it("marks the visit on every route after a successful refresh", async () => {
    const response = await refreshThrough(refreshed());

    expect(response.headers.getSetCookie()).toContain(
      "campus_refresh_attempted=1; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=60",
    );
  });

  it("omits Secure from the marker on plain HTTP", async () => {
    const response = await refreshThrough(refreshed(), "http://127.0.0.1:3100");

    expect(response.headers.getSetCookie()).toContain(
      "campus_refresh_attempted=1; HttpOnly; SameSite=Lax; Path=/; Max-Age=60",
    );
  });

  it.each([401, 503])(
    "does not mark the visit when the refresh answers %i",
    async (status) => {
      const response = await refreshThrough(new Response(null, { status }));

      expect(response.headers.getSetCookie().join("\n")).not.toContain(
        "campus_refresh_attempted",
      );
    },
  );

  it("does not mark the visit for other successful auth requests", async () => {
    const handler = createApiProxy({
      ...baseOptions,
      fetch: () => Promise.resolve(new Response(null, { status: 204 })),
    });

    const response = await handler(
      new Request("https://frontend.example.test/api/v1/auth/logout", {
        method: "POST",
        headers: {
          origin: "https://frontend.example.test",
          "x-forwarded-host": "frontend.example.test",
          "x-forwarded-proto": "https",
        },
      }),
      { params: Promise.resolve({ path: ["v1", "auth", "logout"] }) },
    );

    expect(response.headers.getSetCookie().join("\n")).not.toContain(
      "campus_refresh_attempted",
    );
  });

  it("never forwards the marker to the backend", async () => {
    let outboundCookie: string | null | undefined;
    const handler = createApiProxy({
      ...baseOptions,
      fetch: (request) => {
        outboundCookie = request.headers.get("cookie");
        return Promise.resolve(Response.json({ scope: "full_access" }));
      },
    });

    await handler(
      new Request("https://frontend.example.test/api/v1/auth/me", {
        headers: {
          cookie: "campus_session=session-token; campus_refresh_attempted=1",
          origin: "https://frontend.example.test",
        },
      }),
      { params: Promise.resolve({ path: ["v1", "auth", "me"] }) },
    );

    expect(outboundCookie).toBe("campus_session=session-token");
  });
});
