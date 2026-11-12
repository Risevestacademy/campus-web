import { afterEach, describe, expect, it, vi } from "vitest";

import { ANALYTICS_EVENTS } from "@/core/analytics";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import { createPresenceStore } from "@/core/presence";
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
  };
}

function presenceWith(spaces: Array<{ spaceKey: string; name: string }> = []) {
  const store = createPresenceStore();
  store.getState().apply({
    type: "snapshot",
    map: { id: "campus", version: "v1", width: 5, height: 4 },
    players: [],
    spaces,
  });
  return store.getState();
}

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
    expect(walkEndedNotice(ended(reason), presenceWith())).toBe(notice);
  });

  it("names the space that refused the member", () => {
    const presence = presenceWith([{ spaceKey: "library", name: "Library" }]);

    expect(walkEndedNotice(ended("refused", "library"), presence)).toBe(
      "You can't enter Library.",
    );
  });

  it("says a refusing space is locked when it is", () => {
    const presence = {
      ...presenceWith([{ spaceKey: "library", name: "Library" }]),
      lockedSpaces: ["library"],
    };

    expect(walkEndedNotice(ended("refused", "library"), presence)).toBe(
      "Library is locked.",
    );
  });

  it("still reads when world names no space", () => {
    expect(walkEndedNotice(ended("refused"), presenceWith())).toBe(
      "You can't enter that space.",
    );
  });
});

describe("announceWalkEnded", () => {
  it("records only the reason, and stays quiet when the member arrived", () => {
    const addToast = vi.spyOn(toast, "add");

    announceWalkEnded(ended("arrived"), presenceWith());

    expect(captureBrowserAnalyticsEvent).toHaveBeenCalledExactlyOnceWith(
      ANALYTICS_EVENTS.CAMPUS_WORLD_GO_TO_ENDED,
      { reason: "arrived" },
    );
    expect(addToast).not.toHaveBeenCalled();
  });

  it("tells the member why the walk stopped", () => {
    const addToast = vi.spyOn(toast, "add");

    announceWalkEnded(ended("gone"), presenceWith());

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "They've left the campus." }),
    );
  });

  it("ignores every other frame", () => {
    const addToast = vi.spyOn(toast, "add");

    announceWalkEnded(serverFrames.pong, presenceWith());

    expect(captureBrowserAnalyticsEvent).not.toHaveBeenCalled();
    expect(addToast).not.toHaveBeenCalled();
  });
});
