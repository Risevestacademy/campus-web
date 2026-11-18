import { describe, expect, it } from "vitest";

import { parseCohortTrackCollection } from "./cohort-track.schema";

const timestamps = {
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function cohortDetailBody(track: Record<string, unknown> = {}) {
  return {
    id: "cohort-1",
    name: "Cohort 1",
    code: "C1",
    startDate: "2026-09-01",
    endDate: null,
    status: "active",
    ...timestamps,
    tracks: [
      {
        id: "association-1",
        cohortId: "cohort-1",
        createdAt: timestamps.createdAt,
        track: {
          id: "track-1",
          name: "Computer Science",
          code: "CSC",
          description: null,
          ...timestamps,
          ...track,
        },
      },
    ],
  };
}

describe("parseCohortTrackCollection", () => {
  it("keeps only the fields cohort track administration reads", () => {
    expect(parseCohortTrackCollection(cohortDetailBody())).toStrictEqual({
      cohort: { id: "cohort-1", name: "Cohort 1", code: "C1" },
      tracks: [
        {
          id: "association-1",
          track: {
            id: "track-1",
            name: "Computer Science",
            code: "CSC",
            description: null,
          },
        },
      ],
    });
  });

  it("rejects a track without a code", () => {
    expect(
      parseCohortTrackCollection(cohortDetailBody({ code: undefined })),
    ).toBeUndefined();
  });
});
