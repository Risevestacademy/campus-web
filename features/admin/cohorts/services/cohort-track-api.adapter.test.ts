// @vitest-environment node

import { http, HttpResponse } from "msw";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/core/api/client";

import {
  attachCohortTrack,
  detachCohortTrack,
  readCohortTracks,
} from "./cohort-track-api.adapter";

const mockApi = await vi.hoisted(async () => {
  const { startMockApi } = await import("@/tests/fixtures/mock-api");
  return startMockApi();
});

const API_ORIGIN = "https://api.example.test";
const COHORT_ID = "11111111-1111-4111-8111-111111111111";
const TRACK_ID = "33333333-3333-4333-8333-333333333333";
const COHORT_URL = `${API_ORIGIN}/v1/cohorts/${COHORT_ID}`;
const ATTACHMENTS_URL = `${COHORT_URL}/tracks`;
const ASSOCIATION_URL = `${ATTACHMENTS_URL}/${TRACK_ID}`;
const api = createApiClient({ baseUrl: API_ORIGIN });

const track = {
  id: TRACK_ID,
  name: "Software Engineering",
  code: "SE",
  description: "Backend and infrastructure",
  createdAt: "2026-09-22T12:00:00.000Z",
  updatedAt: "2026-09-22T12:00:00.000Z",
};

const cohortDetail = {
  id: COHORT_ID,
  name: "Cohort 1",
  code: "C1",
  startDate: "2026-09-01",
  endDate: null,
  status: "active",
  createdAt: "2026-09-22T12:00:00.000Z",
  updatedAt: "2026-09-22T12:00:00.000Z",
  tracks: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      cohortId: COHORT_ID,
      track,
      createdAt: "2026-09-22T12:00:00.000Z",
    },
  ],
};

afterEach(() => mockApi.reset());
afterAll(() => mockApi.close());

describe("Cohort Track API adapter", () => {
  it("reads attached Tracks from the Cohort detail endpoint", async () => {
    mockApi.server.use(http.get(COHORT_URL, () => Response.json(cohortDetail)));

    await expect(readCohortTracks(api, COHORT_ID)).resolves.toEqual({
      kind: "loaded",
      cohort: { id: COHORT_ID, name: "Cohort 1", code: "C1" },
      tracks: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          track: {
            id: TRACK_ID,
            name: "Software Engineering",
            code: "SE",
            description: "Backend and infrastructure",
          },
        },
      ],
    });
    expect(mockApi.requests.map(({ method, url }) => [method, url])).toEqual([
      ["GET", COHORT_URL],
    ]);
  });

  it("reports malformed Cohort detail as unavailable", async () => {
    mockApi.server.use(
      http.get(COHORT_URL, () =>
        Response.json({ ...cohortDetail, tracks: [{ id: "association-1" }] }),
      ),
    );

    await expect(readCohortTracks(api, COHORT_ID)).resolves.toEqual({
      kind: "unavailable",
    });
  });

  it("POSTs only the selected trackId to the Cohort attachment endpoint", async () => {
    const bodies: unknown[] = [];
    mockApi.server.use(
      http.post(ATTACHMENTS_URL, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(cohortDetail.tracks[0], { status: 201 });
      }),
    );

    await expect(attachCohortTrack(api, COHORT_ID, TRACK_ID)).resolves.toEqual({
      kind: "attached",
    });
    expect(bodies).toEqual([{ trackId: TRACK_ID }]);
  });

  it("DELETEs only the explicit Cohort Track association", async () => {
    mockApi.server.use(
      http.delete(
        ASSOCIATION_URL,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    await expect(detachCohortTrack(api, COHORT_ID, TRACK_ID)).resolves.toEqual({
      kind: "detached",
    });
    expect(mockApi.requests.map(({ method, url }) => [method, url])).toEqual([
      ["DELETE", ASSOCIATION_URL],
    ]);
  });

  it("distinguishes attachment and detachment conflicts", async () => {
    mockApi.server.use(
      http.post(ATTACHMENTS_URL, () => new Response(null, { status: 409 })),
      http.delete(ASSOCIATION_URL, () => new Response(null, { status: 409 })),
    );

    await expect(attachCohortTrack(api, COHORT_ID, TRACK_ID)).resolves.toEqual({
      kind: "problem",
      problem: "already-attached",
    });
    await expect(detachCohortTrack(api, COHORT_ID, TRACK_ID)).resolves.toEqual({
      kind: "problem",
      problem: "in-use",
    });
  });

  it.each([
    [400, "invalid"],
    [401, "signed-out"],
    [403, "forbidden"],
    [404, "missing"],
    [500, "unavailable"],
  ])("maps detach HTTP %i to %s", async (status, problem) => {
    mockApi.server.use(
      http.delete(ASSOCIATION_URL, () => new Response(null, { status })),
    );

    await expect(detachCohortTrack(api, COHORT_ID, TRACK_ID)).resolves.toEqual({
      kind: "problem",
      problem,
    });
  });
});
