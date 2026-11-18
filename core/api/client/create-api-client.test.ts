// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createApiClient } from "./create-api-client";
import type { components } from "./generated/schema";

const healthResponse = {
  status: "ok",
  timestamp: "2026-09-09T12:00:00.000Z",
  uptime: { seconds: 86_400.12 },
  memory: {
    rss: 123_456_789,
    heapTotal: 98_304_000,
    heapUsed: 61_440_000,
    external: 8_912_896,
  },
  cpu: {
    user: 823_456,
    system: 123_456,
    total: 946_912,
  },
  loadAverage: {
    "1m": 1.5,
    "5m": 1.2,
    "15m": 1.1,
  },
} satisfies components["schemas"]["HealthResponseDto"];

describe("createApiClient", () => {
  it("uses the configured origin without duplicating the API version", async () => {
    let outboundRequest: Request | undefined;
    const api = createApiClient({
      baseUrl: "https://api.example.test/",
      fetch: (request) => {
        outboundRequest = request;
        return Promise.resolve(Response.json(healthResponse));
      },
    });

    await api.GET("/v1/health");

    expect(outboundRequest?.url).toBe("https://api.example.test/v1/health");
  });
});
