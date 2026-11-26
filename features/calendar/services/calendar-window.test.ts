import { describe, expect, it } from "vitest";

import {
  addDays,
  daysOf,
  rangeOf,
  startOfWeek,
  stepAnchor,
  windowOf,
} from "./calendar-window";

process.env.TZ = "Europe/London";

// Wednesday 30 September 2026.
const WEDNESDAY = new Date(2026, 8, 30, 14, 20);

describe("rangeOf", () => {
  it("runs a week from the Monday to the next Monday", () => {
    const { start, end } = rangeOf("week", WEDNESDAY);

    expect(start).toEqual(new Date(2026, 8, 28));
    expect(end).toEqual(new Date(2026, 9, 5));
  });

  it("puts a Sunday at the end of its own week", () => {
    expect(rangeOf("week", new Date(2026, 9, 4, 23, 30)).start).toEqual(
      new Date(2026, 8, 28),
    );
  });

  it("is the one day for Day", () => {
    const { start, end } = rangeOf("day", WEDNESDAY);

    expect(start).toEqual(new Date(2026, 8, 30));
    expect(end).toEqual(new Date(2026, 9, 1));
  });

  it("is six whole weeks from the Monday on or before the 1st for Month", () => {
    const range = rangeOf("month", WEDNESDAY);

    // 1 September 2026 is a Tuesday.
    expect(range.start).toEqual(new Date(2026, 7, 31));
    expect(daysOf(range)).toHaveLength(42);
    expect(daysOf(range).every((day) => day.getHours() === 0)).toBe(true);
  });

  it("keeps a week whole when the clocks change inside it", () => {
    // The clocks went back on Sunday 25 October 2026.
    const days = daysOf(rangeOf("week", new Date(2026, 9, 22)));

    expect(days).toHaveLength(7);
    expect(days.map((day) => day.getDate())).toEqual([
      19, 20, 21, 22, 23, 24, 25,
    ]);
    expect(days.every((day) => day.getHours() === 0)).toBe(true);
  });
});

describe("stepAnchor", () => {
  it.each([
    ["day", new Date(2026, 9, 1)],
    ["week", new Date(2026, 9, 7)],
    ["month", new Date(2026, 9, 30)],
  ] as const)("steps a %s forward", (view, expected) => {
    expect(stepAnchor(view, WEDNESDAY, 1)).toEqual(expected);
  });

  it("steps back", () => {
    expect(stepAnchor("week", WEDNESDAY, -1)).toEqual(new Date(2026, 8, 23));
  });

  it("lands on the last day of a shorter month", () => {
    expect(stepAnchor("month", new Date(2026, 0, 31), 1)).toEqual(
      new Date(2026, 1, 28),
    );
  });
});

describe("windowOf", () => {
  it("asks for the days shown, as instants", () => {
    const { from, to } = windowOf(rangeOf("week", WEDNESDAY));

    expect(new Date(from)).toEqual(new Date(2026, 8, 28));
    expect(new Date(to)).toEqual(new Date(2026, 9, 5));
  });

  it("never asks for more than the 62 days campus-api reads", () => {
    const start = new Date(2026, 2, 1);
    const { from, to } = windowOf({ start, end: addDays(start, 100) });

    expect(new Date(to)).toEqual(addDays(new Date(from), 62));
  });

  it("starts weeks on Monday", () => {
    expect(startOfWeek(new Date(2026, 9, 4)).getDay()).toBe(1);
  });
});
