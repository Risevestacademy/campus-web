import { describe, expect, it } from "vitest";

import { relativeTime } from "./relative-time";

const NOW = Date.parse("2026-11-11T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("relativeTime", () => {
  it.each([
    ["under a minute", 30_000, "just now"],
    ["a skewed clock, ahead of now", -5 * 60_000, "just now"],
    ["a minute", 60_000, "1 minute ago"],
    ["many minutes", 17 * 60_000, "17 minutes ago"],
    ["an hour", 3_600_000, "1 hour ago"],
    ["many hours", 5 * 3_600_000 + 40 * 60_000, "5 hours ago"],
    ["a day", 86_400_000, "yesterday"],
    ["many days", 6 * 86_400_000, "6 days ago"],
  ])("reads %s as %s", (_, elapsed, text) => {
    expect(relativeTime(ago(elapsed), NOW)).toBe(text);
  });

  it("reads a time it cannot parse as nothing", () => {
    expect(relativeTime("yesterday-ish", NOW)).toBe("");
  });
});
