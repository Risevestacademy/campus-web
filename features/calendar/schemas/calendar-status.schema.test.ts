import { describe, expect, it } from "vitest";

import { parseCalendarStatus } from "./calendar-status.schema";

describe("parseCalendarStatus", () => {
  it("keeps whether the calendar is connected and nothing else", () => {
    expect(
      parseCalendarStatus({
        connected: true,
        truncated: false,
        events: [{ id: "e-1", title: "Private dentist appointment" }],
      }),
    ).toStrictEqual({ connected: true });
  });

  it("reads a calendar that is not connected", () => {
    expect(
      parseCalendarStatus({ connected: false, events: [], truncated: false }),
    ).toStrictEqual({ connected: false });
  });

  it.each([
    ["no answer", undefined],
    ["a connected flag that is not a boolean", { connected: "yes" }],
    ["no connected flag", { events: [] }],
  ])("refuses %s", (_, value) => {
    expect(parseCalendarStatus(value)).toBeUndefined();
  });
});
