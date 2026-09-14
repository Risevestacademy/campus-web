// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "@/core/observability";

import {
  readCampusApiBaseUrl,
  readCampusOpenApiUrl,
} from "../../core/api/campus/configuration";
import { createCampusApi } from "../../core/api/campus/create-campus-api";
import { createCampusApiProxy } from "../../core/api/campus/proxy";
import { getCampusServerApi } from "../../core/api/campus/server";

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
  vi.stubEnv("CAMPUS_API_BASE_URL", "https://api.example.test");
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

describe("Campus API foundation eval (required threshold: 9/9)", () => {
  it("loads the browser proxy route without build-time configuration", async () => {
    vi.stubEnv("CAMPUS_API_BASE_URL", "");

    await expect(
      import("../../app/api/campus/[...path]/route"),
    ).resolves.toMatchObject({
      GET: expect.any(Function),
      POST: expect.any(Function),
    });
  });

  it("derives the OpenAPI document from environment configuration", () => {
    expect(
      readCampusOpenApiUrl({
        CAMPUS_API_BASE_URL: "https://api.example.test",
      }),
    ).toBe("https://api.example.test/docs-json");
  });

  it("accepts Railway private networking without allowing public HTTP", () => {
    expect(
      readCampusApiBaseUrl({
        CAMPUS_API_BASE_URL: "http://campus-api.railway.internal:3000",
      }),
    ).toBe("http://campus-api.railway.internal:3000");
    expect(() =>
      readCampusApiBaseUrl({
        CAMPUS_API_BASE_URL: "http://campus-api.example.test",
      }),
    ).toThrow();
  });

  it("creates a generated client against the configured origin", async () => {
    let outboundUrl: string | undefined;
    const api = createCampusApi({
      baseUrl: "https://api.example.test/",
      fetch: (request) => {
        outboundUrl = request.url;
        return Promise.resolve(Response.json({ status: "ok" }));
      },
    });

    await api.GET("/v1/health");

    expect(outboundUrl).toBe("https://api.example.test/v1/health");
  });

  it("sends a request-local cookie on the direct server path", async () => {
    let outboundCookie: string | null | undefined;
    const api = await getCampusServerApi({
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
    const handler = createCampusApiProxy({
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
      new Request(
        "https://frontend.example.test/api/campus/v1/health?verbose=true",
        { headers: { cookie: "accessToken=session-token; theme=dark" } },
      ),
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
    const handler = createCampusApiProxy({
      baseUrl: "https://api.example.test",
      logger: quietLogger,
      fetch: () => {
        upstreamCalls += 1;
        return Promise.resolve(new Response(null, { status: 204 }));
      },
    });

    const response = await handler(
      new Request("https://frontend.example.test/api/campus/v1/profile", {
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
    const handler = createCampusApiProxy({
      baseUrl: "https://api.example.test",
      generateRequestId: () => "eval-request",
      logger: quietLogger,
      fetch: () => {
        throw new Error("private network detail");
      },
    });

    const response = await handler(
      new Request("https://frontend.example.test/api/campus/v1/health"),
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
    const handler = createCampusApiProxy({
      baseUrl: "https://api.example.test",
      logger: quietLogger,
      fetch: () => Promise.resolve(new Response("{}", { headers })),
    });

    const response = await handler(
      new Request("https://frontend.example.test/api/campus/v1/session"),
      { params: Promise.resolve({ path: ["v1", "session"] }) },
    );

    expect(response.headers.getSetCookie()).toEqual([
      "accessToken=renewed; HttpOnly; Secure; SameSite=Lax; Path=/",
    ]);
  });
});
