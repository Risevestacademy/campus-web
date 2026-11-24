import { describe, expect, it } from "vitest";

import { weekWindowOf } from "./calendar-window";

describe("weekWindowOf", () => {
  it("runs from the Monday that starts the week to the next Monday", () => {
    // Wednesday 30 September 2026, in the zone the tests run in.
    const { from, to } = weekWindowOf(new Date(2026, 8, 30, 14, 20));

    expect(new Date(from)).toEqual(new Date(2026, 8, 28));
    expect(new Date(to)).toEqual(new Date(2026, 9, 5));
  });

  it("puts a Sunday at the end of its own week, not the start of the next", () => {
    const { from } = weekWindowOf(new Date(2026, 9, 4, 23, 30));

    expect(new Date(from)).toEqual(new Date(2026, 8, 28));
  });

  it("starts a Monday at that Monday's midnight", () => {
    const { from } = weekWindowOf(new Date(2026, 8, 28, 0, 0));

    expect(new Date(from)).toEqual(new Date(2026, 8, 28));
  });

  it("stays within the 62 days campus-api reads", () => {
    const { from, to } = weekWindowOf(new Date(2026, 2, 29, 12));

    expect(Date.parse(to) - Date.parse(from)).toBeLessThanOrEqual(
      62 * 86_400_000,
    );
  });
});
