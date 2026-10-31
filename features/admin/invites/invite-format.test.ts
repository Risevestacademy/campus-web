// @vitest-environment node

import { describe, expect, it } from "vitest";

import { describeExpiry, sentOn } from "./invite-format";

const NOW = Date.parse("2026-10-10T12:00:00.000Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function pending(inMs: number) {
  return {
    status: "pending" as const,
    expiresAt: new Date(NOW + inMs).toISOString(),
    revokedAt: null,
  };
}

describe("describeExpiry", () => {
  it("counts days left, rounding up, and flags the last two", () => {
    expect(describeExpiry(pending(3 * HOUR), NOW)).toEqual({
      text: "1 day",
      soon: true,
    });
    expect(describeExpiry(pending(2 * DAY), NOW)).toEqual({
      text: "2 days",
      soon: true,
    });
    expect(describeExpiry(pending(5 * DAY - HOUR), NOW)).toEqual({
      text: "5 days",
      soon: false,
    });
  });

  it("reads a pending invite past its time as expired", () => {
    expect(describeExpiry(pending(-HOUR), NOW).text).toBe("Expired");
  });

  it("says how long ago an expired invite lapsed", () => {
    const expired = (agoMs: number) => ({
      status: "expired" as const,
      expiresAt: new Date(NOW - agoMs).toISOString(),
      revokedAt: null,
    });

    expect(describeExpiry(expired(HOUR), NOW).text).toBe("Expired today");
    expect(describeExpiry(expired(DAY), NOW).text).toBe("Expired 1 day ago");
    expect(describeExpiry(expired(4 * DAY), NOW).text).toBe(
      "Expired 4 days ago",
    );
  });

  it("dates a revoked invite by when it was revoked", () => {
    expect(
      describeExpiry(
        {
          status: "revoked",
          expiresAt: "2026-10-20T00:00:00.000Z",
          revokedAt: "2026-10-04T09:00:00.000Z",
        },
        NOW,
      ).text,
    ).toBe("4 Oct 2026");
  });

  it("names an answered invite by its answer", () => {
    const base = { expiresAt: "2026-10-20T00:00:00.000Z", revokedAt: null };

    expect(describeExpiry({ ...base, status: "accepted" }, NOW).text).toBe(
      "Accepted",
    );
    expect(describeExpiry({ ...base, status: "declined" }, NOW).text).toBe(
      "Declined",
    );
  });
});

describe("sentOn", () => {
  it("prints the day in a fixed zone", () => {
    expect(sentOn({ createdAt: "2026-10-03T23:30:00.000Z" })).toBe(
      "3 Oct 2026",
    );
  });
});
