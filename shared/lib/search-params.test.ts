import { describe, expect, it } from "vitest";

import { firstSearchParameter, parsePageNumber } from "./search-params";

describe("firstSearchParameter", () => {
  it.each([
    [undefined, undefined],
    ["2", "2"],
    [["2", "abc"], "2"],
  ])("reads %j as %j", (value, expected) => {
    expect(firstSearchParameter(value)).toBe(expected);
  });
});

describe("parsePageNumber", () => {
  it.each([
    ["1", 1],
    ["2", 2],
    ["40", 40],
    ["9007199254740991", 9007199254740991],
  ])("reads %j as page %i", (value, page) => {
    expect(parsePageNumber(value)).toBe(page);
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
    "0x10",
    "+1",
    "Infinity",
    "١",
    "9".repeat(400),
  ])("falls back to page 1 for %j", (value) => {
    expect(parsePageNumber(value)).toBe(1);
  });
});
