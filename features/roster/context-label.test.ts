import { describe, expect, it } from "vitest";

import { contextLabelFor } from "./context-label";

describe("contextLabelFor", () => {
  it.each([
    ["student", "Product Design 2026 · Student"],
    ["professor", "Product Design 2026 · Professor"],
    ["mentor", "Product Design 2026 · Mentor"],
    ["guest", "Product Design 2026 · Guest"],
  ] as const)("names the cohort and a %s", (role, label) => {
    expect(contextLabelFor({ name: "Product Design 2026", role })).toBe(label);
  });

  it("names only the cohort when the session carries no role", () => {
    expect(contextLabelFor({ name: "Product Design 2026" })).toBe(
      "Product Design 2026",
    );
  });

  it("reads an administrator with no place in the cohort as one", () => {
    expect(contextLabelFor(undefined)).toBe("Administrator");
  });
});
