// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "@/core/observability";

import { browserApi } from "../../core/api/client/browser";
import {
  readApiBaseUrl,
  readOpenApiUrl,
} from "../../core/api/client/configuration";
import { createApiClient } from "../../core/api/client/create-api-client";
import { createApiProxy } from "../../core/api/client/proxy";
import { getServerApi } from "../../core/api/client/server";

const nextHeaders = vi.hoisted(() => ({
  cookies: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: nextHeaders.cookies,
}));

vi.mock("server-only", () => ({}));

const quietLogger: Logger = {
  error: () => {},
  info: () => {},
  warn: () => {},
};

beforeEach(() => {
  vi.stubEnv("API_BASE_URL", "https://api.example.test");
  nextHeaders.cookies.mockResolvedValue({
    get: (name: string) =>
      name === "accessToken"
        ? { name: "accessToken", value: "session-token" }
        : undefined,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("API client foundation eval (required threshold: 11/11)", () => {
  it("rejects an origin-less GET while the deployment diagnostic is enabled", async () => {
    let upstreamCalls = 0;
    const handler = createApiProxy({
      baseUrl: "https://api.example.test",
      logger: quietLogger,
      fetch: () => {
        upstreamCalls += 1;
        return Promise.resolve(new Response(null, { status: 204 }));
      },
    });

    const response = await handler(
      new Request("https://frontend.example.test/api/v1/health"),
      { params: Promise.resolve({ path: ["v1", "health"] }) },
    );

    expect(response.status).toBe(403);
    expect(upstreamCalls).toBe(0);
  });

  it("loads the browser proxy route without build-time configuration", async () => {
    vi.stubEnv("API_BASE_URL", "");

    await expect(
      import("../../app/api/[...path]/route"),
    ).resolves.toMatchObject({
      GET: expect.any(Function),
      POST: expect.any(Function),
    });
  });

  it("derives the OpenAPI document from environment configuration", () => {
    expect(
      readOpenApiUrl({
        API_BASE_URL: "https://api.example.test",
      }),
    ).toBe("https://api.example.test/docs-json");
  });

  it("accepts Railway private networking without allowing public HTTP", () => {
    expect(
      readApiBaseUrl({
        API_BASE_URL: "http://campus-api.railway.internal:3000",
      }),
    ).toBe("http://campus-api.railway.internal:3000");
    expect(() =>
      readApiBaseUrl({
        API_BASE_URL: "http://campus-api.example.test",
      }),
    ).toThrow();
  });

  it("creates a generated client against the configured origin", async () => {
    let outboundUrl: string | undefined;
    const api = createApiClient({
      baseUrl: "https://api.example.test/",
      fetch: (request) => {
        outboundUrl = request.url;
        return Promise.resolve(Response.json({ status: "ok" }));
      },
    });

    await api.GET("/v1/health");

    expect(outboundUrl).toBe("https://api.example.test/v1/health");
  });

  it("mirrors backend paths beneath the frontend API namespace", async () => {
    let outboundUrl: string | undefined;

    class SameOriginRequest extends Request {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        const url =
          typeof input === "string" || input instanceof URL ? input : input.url;

        super(new URL(url, "https://frontend.example.test"), init);
      }
    }

    await browserApi.GET("/v1/health", {
      Request: SameOriginRequest,
      fetch: (request) => {
        outboundUrl = request.url;
        return Promise.resolve(Response.json({ status: "ok" }));
      },
    });

    expect(outboundUrl).toBe("https://frontend.example.test/api/v1/health");
  });

  it("sends a request-local cookie on the direct server path", async () => {
    let outboundCookie: string | null | undefined;
    const api = await getServerApi({
      fetch: (request) => {
        outboundCookie = request.headers.get("cookie");
        return Promise.resolve(Response.json({ status: "ok" }));
      },
    });

    await api.GET("/v1/health");

    expect(outboundCookie).toBe("accessToken=session-token");
  });

  it("proxies a browser request without leaking unrelated cookies", async () => {
    let outboundRequest: Request | undefined;
    const handler = createApiProxy({
      baseUrl: "https://api.example.test",
      logger: quietLogger,
      fetch: (request) => {
        outboundRequest = request;
        return Promise.resolve(
          Response.json(
            { status: "ok" },
            {
              headers: {
                "cache-control": "public, max-age=3600",
              },
            },
          ),
        );
      },
    });

    const response = await handler(
      new Request("https://frontend.example.test/api/v1/health?verbose=true", {
        headers: {
          cookie: "accessToken=session-token; theme=dark",
          origin: "https://frontend.example.test",
        },
      }),
      { params: Promise.resolve({ path: ["v1", "health"] }) },
    );

    expect(outboundRequest?.url).toBe(
      "https://api.example.test/v1/health?verbose=true",
    );
    expect(outboundRequest?.headers.get("cookie")).toBe(
      "accessToken=session-token",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("rejects a cross-origin mutation before the backend", async () => {
    let upstreamCalls = 0;
    const handler = createApiProxy({
      baseUrl: "https://api.example.test",
      logger: quietLogger,
      fetch: () => {
        upstreamCalls += 1;
        return Promise.resolve(new Response(null, { status: 204 }));
      },
    });

    const response = await handler(
      new Request("https://frontend.example.test/api/v1/profile", {
        body: "{}",
        headers: { origin: "https://attacker.example" },
        method: "POST",
      }),
      { params: Promise.resolve({ path: ["v1", "profile"] }) },
    );

    expect(response.status).toBe(403);
    expect(upstreamCalls).toBe(0);
  });

  it("returns a sanitized correlated response when the backend is unavailable", async () => {
    const handler = createApiProxy({
      baseUrl: "https://api.example.test",
      generateRequestId: () => "eval-request",
      logger: quietLogger,
      fetch: () => {
        throw new Error("private network detail");
      },
    });

    const response = await handler(
      new Request("https://frontend.example.test/api/v1/health", {
        headers: { origin: "https://frontend.example.test" },
      }),
      { params: Promise.resolve({ path: ["v1", "health"] }) },
    );
    const body = await response.text();

    expect(response.status).toBe(502);
    expect(response.headers.get("x-request-id")).toBe("eval-request");
    expect(body).toContain('"code":"INTERNAL_ERROR"');
    expect(body).not.toContain("private network detail");
  });

  it("limits an upstream session response to a frontend-scoped access token", async () => {
    const headers = new Headers();
    headers.append("set-cookie", "theme=dark; Path=/");
    headers.append(
      "set-cookie",
      "accessToken=renewed; Domain=api.example.test; Path=/v1",
    );
    const handler = createApiProxy({
      baseUrl: "https://api.example.test",
      logger: quietLogger,
      fetch: () => Promise.resolve(new Response("{}", { headers })),
    });

    const response = await handler(
      new Request("https://frontend.example.test/api/v1/session", {
        headers: { origin: "https://frontend.example.test" },
      }),
      { params: Promise.resolve({ path: ["v1", "session"] }) },
    );

    expect(response.headers.getSetCookie()).toEqual([
      "accessToken=renewed; HttpOnly; Secure; SameSite=Lax; Path=/",
    ]);
  });
});
