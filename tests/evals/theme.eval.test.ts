import { describe, expect, it } from "vitest";

import { resolveTheme } from "@/shared/theme";

describe("theme resolution evaluation (required threshold: 5/5)", () => {
  it.each([
    { storedTheme: "light", prefersDark: true, expected: "light" },
    { storedTheme: "dark", prefersDark: false, expected: "dark" },
    { storedTheme: null, prefersDark: false, expected: "light" },
    { storedTheme: null, prefersDark: true, expected: "dark" },
    { storedTheme: "unsupported", prefersDark: true, expected: "dark" },
  ])(
    "resolves $storedTheme with prefersDark=$prefersDark to $expected",
    ({ storedTheme, prefersDark, expected }) => {
      expect(resolveTheme(storedTheme, prefersDark)).toBe(expected);
    },
  );
});
