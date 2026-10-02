import { describe, expect, it } from "vitest";

import { parseChooserPage } from "./cohort.schema";

describe("parseChooserPage", () => {
  it.each([
    ["1", 1],
    ["2", 2],
    ["40", 40],
    ["9007199254740991", 9007199254740991],
  ])("reads %j as page %i", (value, page) => {
    expect(parseChooserPage(value)).toBe(page);
  });

  it.each([
    undefined,
    "",
    "0",
    "-1",
    "01",
    "1.5",
    "1e3",
    " 2",
    "2abc",
    "abc",
    "9007199254740992",
  ])("falls back to page 1 for %j", (value) => {
    expect(parseChooserPage(value)).toBe(1);
  });
});
