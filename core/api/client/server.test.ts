// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getServerApi } from "./server";

const nextHeaders = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: nextHeaders.cookies,
  headers: nextHeaders.headers,
}));

vi.mock("server-only", () => ({}));

beforeEach(() => {
  vi.stubEnv("API_BASE_URL", "https://api.example.test");
  nextHeaders.cookies.mockResolvedValue({
    get: (name: string) =>
      name === "campus_session"
        ? { name: "campus_session", value: "session-token" }
        : undefined,
  });
  nextHeaders.headers.mockResolvedValue(new Headers());
});

function captureOutbound() {
  const sent: Request[] = [];
  const fetch = (request: Request) => {
    sent.push(request);
    return Promise.resolve(Response.json({ status: "ok" }));
  };
  return { sent, fetch };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("getServerApi", () => {
  it("forwards only the request session directly to the backend", async () => {
    let outboundRequest: Request | undefined;
    const api = await getServerApi({
      fetch: (request) => {
        outboundRequest = request;
        return Promise.resolve(Response.json({ status: "ok" }));
      },
    });

    await api.GET("/v1/health");

    expect(outboundRequest?.url).toBe("https://api.example.test/v1/health");
    expect(outboundRequest?.headers.get("cookie")).toBe(
      "campus_session=session-token",
    );
  });

  it("keeps credentials isolated between concurrent server clients", async () => {
    nextHeaders.cookies
      .mockResolvedValueOnce({
        get: () => ({ name: "campus_session", value: "token-one" }),
      })
      .mockResolvedValueOnce({
        get: () => ({ name: "campus_session", value: "token-two" }),
      });
    const outboundCookies: Array<string | null> = [];
    const captureRequest = (request: Request) => {
      outboundCookies.push(request.headers.get("cookie"));
      return Promise.resolve(Response.json({ status: "ok" }));
    };

    const [firstApi, secondApi] = await Promise.all([
      getServerApi({ fetch: captureRequest }),
      getServerApi({ fetch: captureRequest }),
    ]);

    await Promise.all([
      firstApi.GET("/v1/health"),
      secondApi.GET("/v1/health"),
    ]);

    expect(outboundCookies).toEqual([
      "campus_session=token-one",
      "campus_session=token-two",
    ]);
  });

  it("encodes the token before placing it in an outbound cookie header", async () => {
    nextHeaders.cookies.mockResolvedValue({
      get: () => ({
        name: "campus_session",
        value: "token; unrelatedCookie=exposed",
      }),
    });
    let outboundRequest: Request | undefined;
    const api = await getServerApi({
      fetch: (request) => {
        outboundRequest = request;
        return Promise.resolve(Response.json({ status: "ok" }));
      },
    });

    await api.GET("/v1/health");

    expect(outboundRequest?.headers.get("cookie")).toBe(
      "campus_session=token%3B%20unrelatedCookie%3Dexposed",
    );
  });

  it("forwards the visitor's X-Forwarded-For so the backend rate-limits each client separately", async () => {
    nextHeaders.headers.mockResolvedValue(
      new Headers({ "x-forwarded-for": "198.51.100.7, 203.0.113.10" }),
    );
    const outbound = captureOutbound();
    const api = await getServerApi({ fetch: outbound.fetch });

    await api.GET("/v1/health");

    expect(outbound.sent[0]?.headers.get("x-forwarded-for")).toBe(
      "198.51.100.7, 203.0.113.10",
    );
  });

  it("sends no X-Forwarded-For when the visitor's request carried none", async () => {
    const outbound = captureOutbound();
    const api = await getServerApi({ fetch: outbound.fetch });

    await api.GET("/v1/health");

    expect(outbound.sent[0]?.headers.has("x-forwarded-for")).toBe(false);
  });

  it("keeps client addresses isolated between concurrent server clients", async () => {
    nextHeaders.headers
      .mockResolvedValueOnce(new Headers({ "x-forwarded-for": "198.51.100.1" }))
      .mockResolvedValueOnce(
        new Headers({ "x-forwarded-for": "198.51.100.2" }),
      );
    const outbound = captureOutbound();

    const [firstApi, secondApi] = await Promise.all([
      getServerApi({ fetch: outbound.fetch }),
      getServerApi({ fetch: outbound.fetch }),
    ]);
    await Promise.all([
      firstApi.GET("/v1/health"),
      secondApi.GET("/v1/health"),
    ]);

    expect(
      outbound.sent.map((request) => request.headers.get("x-forwarded-for")),
    ).toEqual(["198.51.100.1", "198.51.100.2"]);
  });

  it("does not access request cookies or headers for an anonymous server client", async () => {
    let outboundRequest: Request | undefined;
    const api = await getServerApi({
      authentication: "none",
      fetch: (request) => {
        outboundRequest = request;
        return Promise.resolve(Response.json({ status: "ok" }));
      },
    });

    await api.GET("/v1/health");

    expect(nextHeaders.cookies).not.toHaveBeenCalled();
    expect(nextHeaders.headers).not.toHaveBeenCalled();
    expect(outboundRequest?.headers.has("cookie")).toBe(false);
  });
});
