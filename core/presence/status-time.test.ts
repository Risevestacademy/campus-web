// @vitest-environment node

import { describe, expect, it } from "vitest";

import { statusTimeLeft } from "./status-time";

const NOW = Date.parse("2026-10-30T09:00:00.000Z");

function endsAfter(ms: number): string {
  return new Date(NOW + ms).toISOString();
}

describe("statusTimeLeft", () => {
  it.each([
    [1_000, "1 min"],
    [60_000, "1 min"],
    [61_000, "1 min"],
    [91_000, "2 min"],
    [60 * 60_000 + 15_000, "1 h"],
    [4 * 60_000, "4 min"],
    [60 * 60_000, "1 h"],
    [112 * 60_000, "1 h 52 min"],
    [12 * 60 * 60_000, "12 h"],
  ])("reads %i ms left as %s", (ms, label) => {
    expect(statusTimeLeft(endsAfter(ms), NOW)).toBe(label);
  });

  it.each([
    ["a status that lasts", null],
    ["a timer that has ended", endsAfter(0)],
    ["a timer that ended a while ago", endsAfter(-60_000)],
    ["an end time that cannot be read", "soon"],
  ])("says nothing for %s", (_case, statusUntil) => {
    expect(statusTimeLeft(statusUntil, NOW)).toBeNull();
  });
});
