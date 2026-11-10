import { describe, expect, it } from "vitest";

import { parseWalkTargetSpace } from "./walk-target.schema";

describe("parseWalkTargetSpace", () => {
  it.each([
    ["a key", "library", "library"],
    ["a key with underscores", "room_space_1", "room_space_1"],
    ["a key with spaces around it", "  library ", "library"],
  ])("reads %s", (_, value, expected) => {
    expect(parseWalkTargetSpace(value)).toBe(expected);
  });

  it.each([
    ["nothing", undefined],
    ["an empty value", ""],
    ["blanks", "   "],
    ["an overlong key", "x".repeat(65)],
  ])("ignores %s", (_, value) => {
    expect(parseWalkTargetSpace(value)).toBeUndefined();
  });
});
