import { afterEach, describe, expect, it, vi } from "vitest";

import type { ErrorMessage } from "@/core/realtime";
import { toast } from "@/shared/ui/toast";
import { serverFrames } from "@/tests/fixtures/world-frames";

import { announceWorldError, worldErrorNotice } from "./world-error-feedback";

function refused(message: string): ErrorMessage {
  return { type: "error", code: "NOT_ALLOWED", message };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("worldErrorNotice", () => {
  // Every sentence world sends today, from its protocol docs and source.
  it.each([
    ["saying too much too fast", "Slow down a little"],
    ["watching: enter the campus here to do that", "This tab is only watching"],
    ["not on campus: enter it to speak", "You're not on the campus yet"],
    ["not on campus: enter it to do that", "You're not on the campus yet"],
    ["this space cannot be locked", "This space can't be locked"],
    ["you cannot walk to yourself", "You're already here"],
    ["that tile is off the map or in a wall", "You can't go there"],
    ["no space with that key to walk into", "You can't walk there"],
    [
      "walk to a tile in the corridors, not to the corridors",
      "You can't walk there",
    ],
    ["no such space", "That space isn't on this map"],
    ["you are inside it already", "You're already inside"],
    ["you may walk in", "No need to ask"],
    ["this space takes no requests", "This space doesn't take requests"],
    ["ask from beside the space", "Get closer first"],
    ["nobody inside can answer", "Nobody inside can answer"],
    ["you have a request open already", "You're already asking"],
    ["asked again too soon after a no", "Too soon to ask again"],
    ["no request here for you to answer", "That request has already ended"],
    ["no open request of yours to withdraw", "That request has already ended"],
    ["they are not here", "They're not here any more"],
    ["you may not mute them", "You can't do that to them"],
    ["you may not remove them", "You can't do that to them"],
    ["they are in no call", "They aren't in a call"],
    ["they are not in the call", "They aren't in a call"],
    ["their microphone is not on", "Their microphone is already off"],
    ["could not mute them, try again", "We couldn't mute them"],
    ["they are in no space", "They can't be removed from here"],
    [
      "they cannot be removed from this space",
      "They can't be removed from here",
    ],
    ["nowhere outside to move them", "There's nowhere to move them to"],
  ])("words %j as %j", (message, title) => {
    expect(worldErrorNotice(refused(message))?.title).toBe(title);
  });

  it("shows a sentence world adds later, cased as one, under a general title", () => {
    expect(worldErrorNotice(refused("the door is jammed"))).toEqual({
      title: "That didn't work",
      description: "The door is jammed.",
    });
  });

  it("keeps a later sentence's own full stop", () => {
    expect(worldErrorNotice(refused("try later!"))?.description).toBe(
      "Try later!",
    );
  });

  it("cuts an overlong sentence and shows none for a blank one", () => {
    expect(
      worldErrorNotice(refused("x".repeat(400)))?.description?.length,
    ).toBeLessThanOrEqual(142);
    expect(worldErrorNotice(refused("   "))).toEqual({
      title: "That didn't work",
    });
  });

  it("reads a code world adds later like any other refusal", () => {
    expect(
      worldErrorNotice({
        type: "error",
        code: "unknown",
        message: "something new",
      })?.title,
    ).toBe("That didn't work");
  });

  it("calls a malformed message a general fault, not the member's doing", () => {
    expect(
      worldErrorNotice({
        type: "error",
        code: "BAD_MESSAGE",
        message: "whatever it says",
      }),
    ).toEqual({
      title: "Something went wrong",
      description: "Try again. If it keeps happening, report an issue.",
    });
  });

  it("shows nothing for UNAUTHORIZED, which the close policy handles", () => {
    expect(
      worldErrorNotice({
        type: "error",
        code: "UNAUTHORIZED",
        message: "session_revoked",
      }),
    ).toBeNull();
  });
});

describe("announceWorldError", () => {
  it("toasts one warning, replacing the last rather than stacking", () => {
    const add = vi.spyOn(toast, "add");

    announceWorldError(refused("saying too much too fast"));
    announceWorldError(refused("saying too much too fast"));

    expect(add).toHaveBeenCalledTimes(2);
    expect(add).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: "world-error",
        title: "Slow down a little",
        type: "warning",
        priority: "high",
      }),
    );
  });

  it("says nothing for a frame that is not an error", () => {
    const add = vi.spyOn(toast, "add");

    announceWorldError(serverFrames.pong);
    announceWorldError(serverFrames.snapshot);

    expect(add).not.toHaveBeenCalled();
  });

  it("says nothing for UNAUTHORIZED", () => {
    const add = vi.spyOn(toast, "add");

    announceWorldError({
      type: "error",
      code: "UNAUTHORIZED",
      message: "session_revoked",
    });

    expect(add).not.toHaveBeenCalled();
  });
});
