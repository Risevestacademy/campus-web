// @vitest-environment node

import { describe, expect, it } from "vitest";

import { browserApi } from "./browser";

class SameOriginRequest extends Request {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    const url =
      typeof input === "string" || input instanceof URL ? input : input.url;

    super(new URL(url, "https://frontend.example.test"), init);
  }
}

describe("browserApi", () => {
  it("preserves the backend path beneath the frontend API namespace", async () => {
    let outboundRequest: Request | undefined;

    await browserApi.GET("/v1/health", {
      Request: SameOriginRequest,
      fetch: (request) => {
        outboundRequest = request;
        return Promise.resolve(Response.json({ status: "ok" }));
      },
    });

    expect(outboundRequest?.url).toBe(
      "https://frontend.example.test/api/v1/health",
    );
  });
});
