import { describe, expect, it } from "vitest";

import { campusBackground } from "./theme-background";

function themeWith(
  token: string,
): Pick<CSSStyleDeclaration, "getPropertyValue"> {
  return {
    getPropertyValue: (name) => (name === "--color-cobalt-100" ? token : ""),
  };
}

describe("campusBackground", () => {
  it("paints the campus with the theme's cobalt-100 token", () => {
    expect(campusBackground(themeWith(" #123abc "))).toBe("#123abc");
  });

  it.each([
    ["missing", ""],
    ["not hex", "oklch(0.95 0.02 270)"],
    ["short hex", "#fff"],
  ])("falls back to the design value when the token is %s", (_, token) => {
    expect(campusBackground(themeWith(token))).toBe("#e9ecf6");
  });
});
