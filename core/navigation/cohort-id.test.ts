import { describe, expect, it } from "vitest";

import { parseCohortId } from "./cohort-id";

describe("parseCohortId", () => {
  it.each(["c-1", "11111111-1111-4111-8111-111111111111", "Cohort_2026"])(
    "accepts %s",
    (cohortId) => {
      expect(parseCohortId(cohortId)).toBe(cohortId);
    },
  );

  it.each([
    "",
    "   c-1   ",
    "../etc",
    "a?query",
    "a/b",
    "x".repeat(101),
    null,
    undefined,
    7,
  ])("rejects %s", (value) => {
    expect(parseCohortId(value)).toBeUndefined();
  });
});
