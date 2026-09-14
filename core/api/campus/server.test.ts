// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCampusServerApi } from "./server";

const nextHeaders = vi.hoisted(() => ({
  cookies: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: nextHeaders.cookies,
}));

vi.mock("server-only", () => ({}));

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

describe("getCampusServerApi", () => {
  it("forwards only the request access token directly to the backend", async () => {
    let outboundRequest: Request | undefined;
    const api = await getCampusServerApi({
      fetch: (request) => {
        outboundRequest = request;
        return Promise.resolve(Response.json({ status: "ok" }));
      },
    });

    await api.GET("/v1/health");

    expect(outboundRequest?.url).toBe("https://api.example.test/v1/health");
    expect(outboundRequest?.headers.get("cookie")).toBe(
      "accessToken=session-token",
    );
  });

  it("keeps credentials isolated between concurrent server clients", async () => {
    nextHeaders.cookies
      .mockResolvedValueOnce({
        get: () => ({ name: "accessToken", value: "token-one" }),
      })
      .mockResolvedValueOnce({
        get: () => ({ name: "accessToken", value: "token-two" }),
      });
    const outboundCookies: Array<string | null> = [];
    const captureRequest = (request: Request) => {
      outboundCookies.push(request.headers.get("cookie"));
      return Promise.resolve(Response.json({ status: "ok" }));
    };

    const [firstApi, secondApi] = await Promise.all([
      getCampusServerApi({ fetch: captureRequest }),
      getCampusServerApi({ fetch: captureRequest }),
    ]);

    await Promise.all([
      firstApi.GET("/v1/health"),
      secondApi.GET("/v1/health"),
    ]);

    expect(outboundCookies).toEqual([
      "accessToken=token-one",
      "accessToken=token-two",
    ]);
  });

  it("encodes the token before placing it in an outbound cookie header", async () => {
    nextHeaders.cookies.mockResolvedValue({
      get: () => ({
        name: "accessToken",
        value: "token; unrelatedCookie=exposed",
      }),
    });
    let outboundRequest: Request | undefined;
    const api = await getCampusServerApi({
      fetch: (request) => {
        outboundRequest = request;
        return Promise.resolve(Response.json({ status: "ok" }));
      },
    });

    await api.GET("/v1/health");

    expect(outboundRequest?.headers.get("cookie")).toBe(
      "accessToken=token%3B%20unrelatedCookie%3Dexposed",
    );
  });

  it("does not access request cookies for an anonymous server client", async () => {
    let outboundRequest: Request | undefined;
    const api = await getCampusServerApi({
      authentication: "none",
      fetch: (request) => {
        outboundRequest = request;
        return Promise.resolve(Response.json({ status: "ok" }));
      },
    });

    await api.GET("/v1/health");

    expect(nextHeaders.cookies).not.toHaveBeenCalled();
    expect(outboundRequest?.headers.has("cookie")).toBe(false);
  });
});
