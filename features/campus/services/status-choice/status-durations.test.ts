// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  STATUS_DURATION_MAX_SECONDS,
  STATUS_DURATION_MIN_SECONDS,
} from "@/core/realtime";

import { durationRefusalOf, durationSecondsOf } from "./status-durations";

const AFTERNOON = new Date(2026, 9, 30, 15, 0, 0);

describe("durationSecondsOf", () => {
  it.each([
    ["30m", 1_800],
    ["1h", 3_600],
    ["2h", 7_200],
    ["4h", 14_400],
  ] as const)("reads %s as %i seconds", (id, seconds) => {
    expect(durationSecondsOf(id, AFTERNOON)).toBe(seconds);
  });

  it("ends today at local midnight", () => {
    expect(durationSecondsOf("today", AFTERNOON)).toBe(9 * 60 * 60);
  });
});

describe("durationRefusalOf", () => {
  it.each([
    undefined,
    STATUS_DURATION_MIN_SECONDS,
    STATUS_DURATION_MAX_SECONDS,
  ])("accepts %s", (seconds) => {
    expect(durationRefusalOf(seconds)).toBeNull();
  });

  it("refuses today in its last minute", () => {
    const lastMinute = new Date(2026, 9, 30, 23, 59, 30);

    expect(durationRefusalOf(durationSecondsOf("today", lastMinute))).toMatch(
      /less than a minute/i,
    );
  });

  it("refuses today while more than 12 hours of it are left", () => {
    const morning = new Date(2026, 9, 30, 8, 0, 0);

    expect(durationRefusalOf(durationSecondsOf("today", morning))).toMatch(
      /12 hours at most/,
    );
  });
});
