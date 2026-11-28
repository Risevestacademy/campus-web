import { describe, expect, it } from "vitest";

import type { SpaceSettings } from "../types/maps.types";
import { parseSpaceEdit } from "./space-form.schema";

const space: SpaceSettings = {
  id: "space-1",
  mapId: "map-1",
  key: "room_space_1",
  name: "room_space_1",
  kind: null,
  access: "normal",
  audioMode: "proximity",
  capacity: null,
  isMapDefault: false,
};

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  const values = {
    name: "room_space_1",
    kind: "",
    access: "normal",
    audioMode: "proximity",
    ...fields,
  };
  for (const [field, value] of Object.entries(values)) {
    data.set(field, value);
  }
  return data;
}

describe("parseSpaceEdit", () => {
  it("returns only the fields that changed", () => {
    expect(
      parseSpaceEdit(
        space,
        form({ name: " Reading Room ", kind: "meeting_room" }),
      ),
    ).toEqual({
      kind: "valid",
      changes: { name: "Reading Room", kind: "meeting_room" },
    });
  });

  it("reads an empty kind as unset", () => {
    expect(parseSpaceEdit(space, form({}))).toEqual({ kind: "unchanged" });
  });

  it("refuses an empty name and a kind it does not know", () => {
    const read = parseSpaceEdit(space, form({ name: "  ", kind: "ballroom" }));

    expect(read).toMatchObject({
      kind: "invalid",
      errors: { name: "Give the space a name." },
    });
    expect(read.kind === "invalid" && read.errors.kind).toBeTruthy();
  });
});
