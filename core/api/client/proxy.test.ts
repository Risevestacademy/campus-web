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

describe("createApiProxy", () => {
  it("transparently forwards an authenticated backend response", async () => {
    let outboundRequest: Request | undefined;
    const responseBody = {
      status: "ok",
      timestamp: "2026-09-10T00:00:00.000Z",
    };
    const handler = createApiProxy({
      baseUrl: "https://api.example.test",
      logger: quietLogger,
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
          cookie: "accessToken=session-token; theme=dark",
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
      "accessToken=session-token",
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
      baseUrl: "https://api.example.test",
      logger: quietLogger,
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
      new Request("https://frontend.example.test/api/v1/health"),
      { params: Promise.resolve({ path: ["v1", "health"] }) },
    );

    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
  });

  it("streams an unsafe request body to the backend", async () => {
    let outboundBody: string | undefined;
    const handler = createApiProxy({
      baseUrl: "https://api.example.test",
      logger: quietLogger,
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
          cookie: "accessToken=session-token",
          origin: "https://frontend.example.test",
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
      baseUrl: "https://api.example.test",
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
          cookie: "accessToken=session-token",
          origin: "https://attacker.example",
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
      baseUrl: "https://api.example.test",
      clock: () => 125,
      generateRequestId: () => "proxy-request-1",
      logger,
      fetch: () => {
        throw new TypeError("sensitive upstream connection detail");
      },
    });

    const response = await handler(
      new Request("https://frontend.example.test/api/v1/health"),
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
      baseUrl: "https://api.example.test",
      clock: () => timestamps.shift() ?? 125,
      generateRequestId: () => "proxy-request-2",
      logger,
      fetch: (request) => {
        outboundRequest = request;
        return Promise.resolve(Response.json({ status: "ok" }));
      },
    });

    const response = await handler(
      new Request("https://frontend.example.test/api/v1/health"),
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

  it("returns only a frontend-scoped access token cookie", async () => {
    const upstreamHeaders = new Headers({
      "content-type": "application/json",
    });
    upstreamHeaders.append(
      "set-cookie",
      "theme=dark; Domain=api.example.test; Path=/v1",
    );
    upstreamHeaders.append(
      "set-cookie",
      "accessToken=renewed; Domain=api.example.test; Path=/v1",
    );
    const handler = createApiProxy({
      baseUrl: "https://api.example.test",
      logger: quietLogger,
      fetch: () =>
        Promise.resolve(
          new Response("{}", { headers: upstreamHeaders, status: 200 }),
        ),
    });

    const response = await handler(
      new Request("https://frontend.example.test/api/v1/session"),
      { params: Promise.resolve({ path: ["v1", "session"] }) },
    );

    expect(response.headers.getSetCookie()).toEqual([
      "accessToken=renewed; HttpOnly; Secure; SameSite=Lax; Path=/",
    ]);
  });

  it("keeps local HTTP cookies usable while enforcing browser isolation", async () => {
    const upstreamHeaders = new Headers();
    upstreamHeaders.append("set-cookie", "accessToken=renewed; Path=/v1");
    const handler = createApiProxy({
      baseUrl: "https://api.example.test",
      logger: quietLogger,
      fetch: () =>
        Promise.resolve(new Response("{}", { headers: upstreamHeaders })),
    });

    const response = await handler(
      new Request("http://localhost:3000/api/v1/session"),
      { params: Promise.resolve({ path: ["v1", "session"] }) },
    );

    expect(response.headers.getSetCookie()).toEqual([
      "accessToken=renewed; HttpOnly; SameSite=Lax; Path=/",
    ]);
  });

  it("prevents automatic authenticated redirects beyond the backend origin", async () => {
    let redirectMode: RequestRedirect | undefined;
    const handler = createApiProxy({
      baseUrl: "https://api.example.test",
      logger: quietLogger,
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
        headers: { cookie: "accessToken=session-token" },
      }),
      { params: Promise.resolve({ path: ["v1", "profile"] }) },
    );

    expect(redirectMode).toBe("manual");
    expect(response.status).toBe(307);
  });

  it("preserves conditional request and rate-limit response metadata", async () => {
    let outboundRequest: Request | undefined;
    const handler = createApiProxy({
      baseUrl: "https://api.example.test",
      logger: quietLogger,
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
