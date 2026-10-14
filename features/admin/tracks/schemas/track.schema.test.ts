import { describe, expect, it } from "vitest";

import { parseNewTrack, parseTrackEdit, parseTrackList } from "./track.schema";

const track = {
  id: "track-1",
  name: "Computer Science",
  code: "CSC",
  description: "A programme track",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("track schema", () => {
  it("normalizes new track values", () => {
    expect(
      parseNewTrack({
        name: "  Computer Science ",
        code: " csc ",
        description: "  Details  ",
      }),
    ).toEqual({
      kind: "valid",
      track: { name: "Computer Science", code: "CSC", description: "Details" },
    });
  });

  it("only returns changed edit values and clears blank descriptions", () => {
    expect(
      parseTrackEdit(track, {
        name: " Computer Science ",
        code: "csc",
        description: " ",
      }),
    ).toEqual({ kind: "valid", changes: { description: null } });
  });

  it("rejects a blank code", () => {
    expect(
      parseNewTrack({ name: "Computer Science", code: "   ", description: "" })
        .kind,
    ).toBe("invalid");
  });
});

describe("parseTrackList", () => {
  function trackListBody(meta: Record<string, unknown> = {}) {
    return {
      items: [track],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1, ...meta },
    };
  }

  it("keeps only the fields the track list reads", () => {
    expect(parseTrackList(trackListBody())).toStrictEqual({
      tracks: [
        {
          id: "track-1",
          name: "Computer Science",
          code: "CSC",
          description: "A programme track",
        },
      ],
      page: 1,
      totalPages: 1,
    });
  });

  it("rejects a list with page 0", () => {
    expect(parseTrackList(trackListBody({ page: 0 }))).toBeUndefined();
  });
});
