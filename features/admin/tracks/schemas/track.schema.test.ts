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

function trackForm(fields: Record<string, string>) {
  const form = new FormData();
  const filled = {
    name: "Computer Science",
    code: "csc",
    description: "",
    ...fields,
  };
  for (const [field, value] of Object.entries(filled)) form.set(field, value);
  return form;
}

describe("parseNewTrack", () => {
  it("normalizes new track values", () => {
    expect(
      parseNewTrack(
        trackForm({
          name: "  Computer Science ",
          code: " csc ",
          description: "  Details  ",
        }),
      ),
    ).toEqual({
      kind: "valid",
      track: { name: "Computer Science", code: "CSC", description: "Details" },
    });
  });

  it("reads a blank description as absent", () => {
    expect(parseNewTrack(trackForm({ description: "   " }))).toStrictEqual({
      kind: "valid",
      track: { name: "Computer Science", code: "CSC", description: undefined },
    });
  });

  it("rejects a blank code", () => {
    expect(parseNewTrack(trackForm({ code: "   " }))).toStrictEqual({
      kind: "invalid",
      errors: { code: "Enter a programme track code." },
    });
  });
});

describe("parseTrackEdit", () => {
  it("only returns changed edit values and clears blank descriptions", () => {
    expect(
      parseTrackEdit(
        track,
        trackForm({ name: " Computer Science ", description: " " }),
      ),
    ).toStrictEqual({ kind: "valid", changes: { description: null } });
  });

  it("does not produce a mutation when normalized values are unchanged", () => {
    expect(
      parseTrackEdit(track, trackForm({ description: "A programme track" })),
    ).toStrictEqual({ kind: "unchanged" });
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
