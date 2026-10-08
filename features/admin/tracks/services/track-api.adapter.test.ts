// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";

import {
  createTrack,
  deleteTrack,
  editTrack,
  listTracks,
} from "./track-api.adapter";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});
const API_ORIGIN = "https://api.example.test";
const TRACKS_URL = `${API_ORIGIN}/v1/tracks`;
const api = createApiClient({ baseUrl: API_ORIGIN });
const track = {
  id: "track-1",
  name: "Computer Science",
  code: "CSC",
  description: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

describe("track API adapter", () => {
  it("lists tracks with a page", async () => {
    const sent = mockApi.requests;
    mockApi.server.use(
      http.get(TRACKS_URL, ({ request }) => {
        expect(new URL(request.url).searchParams.get("page")).toBe("2");
        return Response.json({
          items: [track],
          meta: { page: 2, perPage: 12, total: 1, totalPages: 1 },
        });
      }),
    );
    await expect(listTracks(api, 2)).resolves.toEqual({
      kind: "loaded",
      tracks: [
        {
          id: track.id,
          name: track.name,
          code: track.code,
          description: track.description,
        },
      ],
      page: 2,
      totalPages: 1,
    });
    expect(sent).toHaveLength(1);
  });

  it("sends create, edit, and delete commands", async () => {
    mockApi.server.use(
      http.post(TRACKS_URL, async ({ request }) => {
        expect(await request.json()).toEqual({
          name: "Computer Science",
          code: "CSC",
          description: "Details",
        });
        return HttpResponse.json(track, { status: 201 });
      }),
      http.patch(`${TRACKS_URL}/track-1`, async ({ request }) => {
        expect(await request.json()).toEqual({ description: null });
        return HttpResponse.json(track);
      }),
      http.delete(
        `${TRACKS_URL}/track-1`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    await expect(
      createTrack(api, {
        name: "Computer Science",
        code: "CSC",
        description: "Details",
      }),
    ).resolves.toEqual({ kind: "created" });
    await expect(
      editTrack(api, "track-1", { description: null }),
    ).resolves.toEqual({ kind: "updated" });
    await expect(deleteTrack(api, "track-1")).resolves.toEqual({
      kind: "deleted",
    });
  });

  it("reports an attached-track conflict without retrying", async () => {
    let calls = 0;
    mockApi.server.use(
      http.delete(`${TRACKS_URL}/track-1`, () => {
        calls += 1;
        return new Response(null, { status: 409 });
      }),
    );
    await expect(deleteTrack(api, "track-1")).resolves.toEqual({
      kind: "problem",
      problem: "attached",
    });
    expect(calls).toBe(1);
  });
});
