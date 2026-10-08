import { describe, expect, it } from "vitest";

import { parseNewTrack, parseTrackEdit } from "./track.schema";

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
