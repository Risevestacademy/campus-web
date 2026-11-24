import { describe, expect, it } from "vitest";

import { formatLoadedTime } from "./loaded-time";

describe("formatLoadedTime", () => {
  it("writes the hour and minute in the viewer's own zone", () => {
    expect(formatLoadedTime(new Date(2026, 8, 30, 14, 20), "en-GB")).toBe(
      "14:20",
    );
  });

  it("pads a morning hour", () => {
    expect(formatLoadedTime(new Date(2026, 8, 30, 9, 5), "en-GB")).toBe(
      "09:05",
    );
  });
});
