// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import {
  type ConnectionCheckDependencies,
  requestConnectionCheck,
} from "./connection-check.service";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const WORLD_ORIGIN = "https://world.example.test";
const MEDIA_ORIGIN = "wss://media.example.test";
const ROUTE = `${WORLD_ORIGIN}/media/connection-check`;
const NOW = Date.parse("2026-10-24T12:00:00.000Z");

const grant = {
  url: MEDIA_ORIGIN,
  room: "connection-check-0b9e",
  token: "eyJ.connection-check.token",
  expiresAt: "2026-10-24T12:02:00.000Z",
};

function dependencies(
  overrides: Partial<ConnectionCheckDependencies> = {},
): ConnectionCheckDependencies {
  return {
    fetch: (input, init) => globalThis.fetch(input, init),
    worldOrigin: WORLD_ORIGIN,
    mediaOrigin: MEDIA_ORIGIN,
    now: () => NOW,
    ...overrides,
  };
}

function worldReplies(reply: () => Response) {
  mockApi.server.use(http.post(ROUTE, reply));
}

function worldError(status: number, code: string, headers?: HeadersInit) {
  return () =>
    HttpResponse.json(
      { error: { code, message: "refused" } },
      { status, headers },
    );
}

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

describe("requestConnectionCheck", () => {
  it("hands back the pinned media URL and the token", async () => {
    worldReplies(() => HttpResponse.json(grant));

    await expect(requestConnectionCheck(dependencies())).resolves.toEqual({
      kind: "ready",
      url: MEDIA_ORIGIN,
      token: grant.token,
    });
  });

  it("posts to world directly with the session cookie and no cache", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json(grant),
    );

    await requestConnectionCheck(dependencies({ fetch }));

    expect(fetch).toHaveBeenCalledWith(
      new URL(ROUTE),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        cache: "no-store",
      }),
    );
    expect(fetch.mock.calls[0]?.[1]?.body).toBeUndefined();
  });

  it("asks world nothing when this build names no media server", async () => {
    await expect(
      requestConnectionCheck(dependencies({ mediaOrigin: undefined })),
    ).resolves.toEqual({ kind: "unavailable" });
    expect(mockApi.requests).toEqual([]);
  });

  it.each([
    ["signed out", worldError(401, "UNAUTHORIZED"), { kind: "signed-out" }],
    [
      "an origin world refuses",
      worldError(403, "FORBIDDEN"),
      { kind: "misconfigured" },
    ],
    [
      "a deployment without media",
      worldError(503, "MEDIA_NOT_CONFIGURED"),
      { kind: "unavailable" },
    ],
    [
      "a 503 that is not world's",
      () => new HttpResponse("Application failed to respond", { status: 503 }),
      { kind: "failed" },
    ],
    ["a server error", worldError(500, "INTERNAL_ERROR"), { kind: "failed" }],
    [
      "a body without a token",
      () => HttpResponse.json({ ...grant, token: "" }),
      { kind: "failed" },
    ],
    [
      "a body that is not JSON",
      () => new HttpResponse("<html>", { status: 200 }),
      { kind: "failed" },
    ],
    [
      "a media URL off the pinned host",
      () => HttpResponse.json({ ...grant, url: "wss://evil.example.test" }),
      { kind: "failed" },
    ],
  ])("reads %s", async (_, reply, expected) => {
    worldReplies(reply);

    await expect(requestConnectionCheck(dependencies())).resolves.toEqual(
      expected,
    );
  });

  it.each([
    ["delay seconds", "17", 17],
    [
      "a date already reached, as one second",
      "Sat, 24 Oct 2026 12:00:00 GMT",
      1,
    ],
    ["an HTTP date", "Sat, 24 Oct 2026 12:00:42 GMT", 42],
    ["no header, as world's one-minute budget", undefined, 60],
    ["garbage, as world's one-minute budget", "soon", 60],
  ])("waits out a rate limit given %s", async (_, retryAfter, seconds) => {
    worldReplies(
      worldError(
        429,
        "RATE_LIMITED",
        retryAfter === undefined ? undefined : { "retry-after": retryAfter },
      ),
    );

    await expect(requestConnectionCheck(dependencies())).resolves.toEqual({
      kind: "rate-limited",
      retryAfterSeconds: seconds,
    });
  });

  it("reads a request the browser refused, offline or by CORS, as failed", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });

    await expect(
      requestConnectionCheck(dependencies({ fetch })),
    ).resolves.toEqual({ kind: "failed" });
  });

  it("lets an abort through to the caller", async () => {
    worldReplies(() => HttpResponse.json(grant));
    const controller = new AbortController();
    controller.abort();

    await expect(
      requestConnectionCheck(dependencies(), controller.signal),
    ).rejects.toThrow(expect.objectContaining({ name: "AbortError" }));
  });
});
