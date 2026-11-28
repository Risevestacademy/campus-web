import { describe, expect, it } from "vitest";

import {
  END_REASON_MAX_LENGTH,
  parseEndMembershipForm,
  parseExtendVisitForm,
  parseMoveTrackForm,
} from "./membership-forms.schema";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("end membership form", () => {
  it("trims the reason and sends none for a blank one", () => {
    expect(
      parseEndMembershipForm(form({ reason: "  Moved abroad " }), {
        reasonRequired: false,
      }),
    ).toEqual({ kind: "valid", request: { reason: "Moved abroad" } });
    expect(
      parseEndMembershipForm(form({ reason: "   " }), {
        reasonRequired: false,
      }),
    ).toEqual({ kind: "valid", request: { reason: undefined } });
  });

  it("requires a reason for a dismissal", () => {
    expect(
      parseEndMembershipForm(form({ reason: "  " }), { reasonRequired: true }),
    ).toEqual({
      kind: "invalid",
      error: "Say why they are being dismissed.",
    });
  });

  it("refuses a reason over campus-api's limit", () => {
    expect(
      parseEndMembershipForm(
        form({ reason: "x".repeat(END_REASON_MAX_LENGTH + 1) }),
        { reasonRequired: false },
      ).kind,
    ).toBe("invalid");
  });
});

describe("move track form", () => {
  it("takes only a track it offered", () => {
    expect(parseMoveTrackForm(form({ trackId: "t-2" }), ["t-2"])).toEqual({
      kind: "valid",
      request: { trackId: "t-2" },
    });
    expect(parseMoveTrackForm(form({ trackId: "" }), ["t-2"])).toEqual({
      kind: "invalid",
      error: "Choose a track.",
    });
    expect(parseMoveTrackForm(form({ trackId: "t-9" }), ["t-2"]).kind).toBe(
      "invalid",
    );
  });
});

describe("extend visit form", () => {
  const NOW = Date.parse("2026-11-28T12:00:00");
  const CURRENT_END = new Date("2026-12-01T12:00:00").toISOString();

  it("sends the chosen local time as an instant", () => {
    expect(
      parseExtendVisitForm(form({ accessExpiresAt: "2026-12-08T18:30" }), {
        currentEnd: CURRENT_END,
        now: NOW,
      }),
    ).toEqual({
      kind: "valid",
      request: {
        accessExpiresAt: new Date("2026-12-08T18:30").toISOString(),
      },
    });
  });

  it("refuses an end that is not later than the current one", () => {
    expect(
      parseExtendVisitForm(form({ accessExpiresAt: "2026-11-30T09:00" }), {
        currentEnd: CURRENT_END,
        now: NOW,
      }),
    ).toEqual({
      kind: "invalid",
      error: "Choose a time later than the visit's current end.",
    });
  });

  it("refuses an empty or malformed end", () => {
    for (const value of ["", "next week", "2026-13-45T99:99"]) {
      expect(
        parseExtendVisitForm(form({ accessExpiresAt: value }), {
          currentEnd: CURRENT_END,
          now: NOW,
        }).kind,
      ).toBe("invalid");
    }
  });
});
