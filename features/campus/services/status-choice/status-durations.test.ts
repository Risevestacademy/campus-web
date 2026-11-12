// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  STATUS_DURATION_MAX_SECONDS,
  STATUS_DURATION_MIN_SECONDS,
} from "@/core/realtime";

import { durationSecondsOf, STATUS_DURATIONS } from "./status-durations";

describe("durationSecondsOf", () => {
  it.each([
    ["30m", 1_800],
    ["1h", 3_600],
    ["2h", 7_200],
    ["4h", 14_400],
  ] as const)("reads %s as %i seconds", (id, seconds) => {
    expect(durationSecondsOf(id)).toBe(seconds);
  });

  it("offers only times world accepts", () => {
    for (const { seconds } of STATUS_DURATIONS) {
      expect(seconds).toBeGreaterThanOrEqual(STATUS_DURATION_MIN_SECONDS);
      expect(seconds).toBeLessThanOrEqual(STATUS_DURATION_MAX_SECONDS);
    }
  });
});
