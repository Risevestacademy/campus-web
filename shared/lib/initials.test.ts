// @vitest-environment node

import { describe, expect, it } from "vitest";

import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it.each([
    ["Ada Lovelace", "AL"],
    ["ada  king lovelace", "AK"],
    ["Grace", "G"],
  ])("takes the first letters of up to two words of %j", (name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });

  it.each([null, undefined, "", "   "])("shows ? for %j", (name) => {
    expect(initialsOf(name)).toBe("?");
  });
});
