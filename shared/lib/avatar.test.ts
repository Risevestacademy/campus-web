// @vitest-environment node

import { describe, expect, it } from "vitest";

import { AVATAR_TONES, avatarToneOf, initialOf } from "./avatar";

describe("initialOf", () => {
  it.each([
    ["Ada Lovelace", "A"],
    ["  ada ", "A"],
    ["😀 Smile", "😀"],
    ["é́ngela", "É́"],
    ["مريم", "م"],
  ])("takes the first character of %j", (name, initial) => {
    expect(initialOf(name)).toBe(initial);
  });

  it.each([null, undefined, "", "   "])("shows ? for %j", (name) => {
    expect(initialOf(name)).toBe("?");
  });
});

describe("avatarToneOf", () => {
  it("gives the same id the same tone every time", () => {
    expect(avatarToneOf("user-1")).toBe(avatarToneOf("user-1"));
  });

  it("uses every tone across enough ids", () => {
    const tones = new Set(
      Array.from({ length: 40 }, (_, index) => avatarToneOf(`user-${index}`)),
    );

    expect([...tones].sort()).toEqual([...AVATAR_TONES].sort());
  });

  it("uses the tone a caller sets over the one the id picks", () => {
    const picked = avatarToneOf("user-1");
    const other = AVATAR_TONES.find((tone) => tone !== picked)!;
    const name = (["info", "lemon", "cobalt", "turquoise"] as const).find(
      (tone) => avatarToneOf("", tone) === other,
    )!;

    expect(avatarToneOf("user-1", name)).toBe(other);
  });
});
