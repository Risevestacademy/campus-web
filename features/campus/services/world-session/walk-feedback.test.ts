import { afterEach, describe, expect, it, vi } from "vitest";

import { ANALYTICS_EVENTS } from "@/core/analytics";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import {
  claimEntryRefusals,
  EMPTY_PRESENCE,
  type Presence,
} from "@/core/presence";
import type { WalkEndedMessage } from "@/core/realtime";
import { toast } from "@/shared/ui/toast";
import { serverFrames } from "@/tests/fixtures/world-frames";

import { announceWalkEnded, walkEndedNotice } from "./walk-feedback";

vi.mock("@/core/analytics/client", () => ({
  captureBrowserAnalyticsEvent: vi.fn(),
}));

function ended(
  reason: WalkEndedMessage["reason"],
  spaceKey: string | null = null,
): WalkEndedMessage {
  return {
    type: "walkEnded",
    reason,
    player: { userId: "ada", x: 1, y: 1, facing: "down" },
    spaceKey,
    mayAsk: false,
  };
}

const presence: Presence = {
  ...EMPTY_PRESENCE,
  lockedSpaces: ["library"],
  spaceNames: new Map([["library", "Library"]]),
};

afterEach(() => {
  vi.mocked(captureBrowserAnalyticsEvent).mockClear();
  vi.restoreAllMocks();
});

describe("walkEndedNotice", () => {
  it.each([
    ["arrived", null],
    ["stopped", null],
    ["unknown", null],
    ["gone", "They've left the campus."],
    ["elsewhere", "They can't be reached right now."],
    ["no_way", "Couldn't find a way to them."],
    ["moved_by_staff", "A staff member moved you out of that space."],
  ] as const)("says for %s: %j", (reason, notice) => {
    expect(walkEndedNotice(ended(reason), presence, false)).toBe(notice);
  });

  it("leaves a refused walk to a mounted map, which offers to ask", () => {
    expect(
      walkEndedNotice(ended("refused", "library"), presence, true),
    ).toBeNull();
  });

  it("says a refused walk itself while no map is mounted", () => {
    expect(walkEndedNotice(ended("refused", "library"), presence, false)).toBe(
      "Library is locked",
    );
  });
});

describe("announceWalkEnded", () => {
  it("records only the reason, and stays quiet when the member arrived", () => {
    const addToast = vi.spyOn(toast, "add");

    announceWalkEnded(ended("arrived"), presence, "c-1");

    expect(captureBrowserAnalyticsEvent).toHaveBeenCalledExactlyOnceWith(
      ANALYTICS_EVENTS.CAMPUS_WORLD_GO_TO_ENDED,
      { reason: "arrived" },
    );
    expect(addToast).not.toHaveBeenCalled();
  });

  it("tells the member why the walk stopped", () => {
    const addToast = vi.spyOn(toast, "add");

    announceWalkEnded(ended("gone"), presence, "c-1");

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "They've left the campus." }),
    );
  });

  it("says a refused walk only while the cohort's map is not mounted", () => {
    const addToast = vi.spyOn(toast, "add");
    const release = claimEntryRefusals("c-1");

    announceWalkEnded(ended("refused", "library"), presence, "c-1");
    expect(addToast).not.toHaveBeenCalled();

    release();
    announceWalkEnded(ended("refused", "library"), presence, "c-1");
    expect(addToast).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ title: "Library is locked" }),
    );
  });

  it("ignores every other frame", () => {
    const addToast = vi.spyOn(toast, "add");

    announceWalkEnded(serverFrames.pong, presence, "c-1");

    expect(captureBrowserAnalyticsEvent).not.toHaveBeenCalled();
    expect(addToast).not.toHaveBeenCalled();
  });
});
