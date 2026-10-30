import { describe, expect, it } from "vitest";

import { avatarTone, initialOf } from "./avatar";

describe("avatarTone", () => {
  it("gives the same id the same tone every time", () => {
    expect(avatarTone("user-1")).toBe(avatarTone("user-1"));
  });

  it("spreads ids over more than one tone", () => {
    const tones = new Set(
      Array.from({ length: 20 }, (_, index) => avatarTone(`user-${index}`)),
    );

    expect(tones.size).toBeGreaterThan(1);
  });

  it("falls back to a tone for an empty id", () => {
    expect(avatarTone("")).toMatch(/^bg-/);
  });
});

describe("initialOf", () => {
  it("is the first letter, upper-cased", () => {
    expect(initialOf("ada lovelace")).toBe("A");
  });
});
