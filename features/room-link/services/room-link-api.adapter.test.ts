// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client/create-api-client";

import { enterRoomLink } from "./room-link-api.adapter";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const API_ORIGIN = "https://api.example.test";
const CODE = "k3F9xQ2pLm";
const ENTER_URL = `${API_ORIGIN}/v1/room-links/${CODE}/enter`;
const api = () => createApiClient({ baseUrl: API_ORIGIN });

function enterReplies(reply: () => Response) {
  mockApi.server.use(http.post(ENTER_URL, reply));
}

afterEach(() => {
  mockApi.reset();
});

afterAll(() => {
  mockApi.close();
});

describe("enterRoomLink", () => {
  it("returns the cohort and space, and nothing else the reply carried", async () => {
    enterReplies(() =>
      HttpResponse.json({
        code: CODE,
        title: "Design review",
        cohortId: "c-1",
        spaceId: "s-1",
        spaceKey: "library",
        spaceName: "Library",
        startsAt: null,
        endsAt: null,
        admitted: true,
      }),
    );

    await expect(enterRoomLink(api(), CODE)).resolves.toEqual({
      kind: "entered",
      cohortId: "c-1",
      spaceKey: "library",
    });
  });

  it.each([
    ["a link that does not exist, was revoked or is not theirs", 404],
    ["a code campus-api finds malformed", 400],
  ])("treats %s as unusable", async (_, code) => {
    enterReplies(() => new Response(null, { status: code }));

    await expect(enterRoomLink(api(), CODE)).resolves.toEqual({
      kind: "unusable",
    });
  });

  it.each([
    ["a server error", () => new Response(null, { status: 503 })],
    ["a session that ended", () => new Response(null, { status: 401 })],
    ["a network failure", () => HttpResponse.error()],
    ["a reply that is not an entry", () => HttpResponse.json({ ok: true })],
  ])("is unavailable after %s", async (_, reply) => {
    enterReplies(reply);

    await expect(enterRoomLink(api(), CODE)).resolves.toEqual({
      kind: "unavailable",
    });
  });
});
