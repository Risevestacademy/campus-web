// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  applyServerMessage,
  EMPTY_PRESENCE,
  type Presence,
} from "@/core/presence";
import type { Avatar, ServerMessage } from "@/core/realtime";
import { callFrame } from "@/tests/fixtures/nearby-presence";

import type {
  Meeting,
  MeetingParticipant,
  OpenedMeetingLayout,
} from "../../types/active-campus.types";
import { selectMeeting, splitAtCap, visibleMeetingLayout } from "./meeting";

function avatar(
  userId: string,
  displayName: string | null,
  spaceKey = "_default",
): Avatar {
  return {
    userId,
    x: 1,
    y: 1,
    facing: "down",
    displayName,
    spriteKey: null,
    status: "available",
    spaceKey,
  };
}

const WELCOME: ServerMessage = {
  type: "welcome",
  userId: "ada",
  connectionId: "connection-1",
  heartbeatSeconds: 30,
  stepMs: 100,
  tickMs: 50,
  displayName: "Ada Lovelace",
  spriteKey: null,
};

const EVERYONE_HERE: ServerMessage = {
  type: "snapshot",
  map: { id: "campus", version: "v1", width: 60, height: 40 },
  players: [
    avatar("ada", "Ada Lovelace"),
    avatar("grace", "Grace Hopper"),
    avatar("lin", null),
  ],
  spaces: [],
};

function nearby(...userIds: string[]): ServerMessage {
  return { type: "nearby", userIds };
}

function meetingAfter(...messages: ServerMessage[]) {
  const presence: Presence = messages.reduce(
    applyServerMessage,
    EMPTY_PRESENCE,
  );
  return selectMeeting(presence);
}

function meetingWith(encounter: number, ...participantIds: string[]): Meeting {
  return {
    encounter,
    hearing: "proximity",
    title: "Nearby",
    localParticipantId: "ada",
    participants: participantIds.map((id): MeetingParticipant => ({
      id,
      initials: "?",
      name: id,
      tone: "cobalt",
    })),
  };
}

describe("selectMeeting", () => {
  it("has no meeting while nobody is near", () => {
    expect(meetingAfter(WELCOME, EVERYONE_HERE)).toBeNull();
  });

  it("has no meeting before welcome says who you are", () => {
    expect(meetingAfter(EVERYONE_HERE, nearby("grace"))).toBeNull();
  });

  it("puts you first, then whoever is near in the order they came", () => {
    const meeting = meetingAfter(
      WELCOME,
      EVERYONE_HERE,
      nearby("lin"),
      nearby("grace", "lin"),
    );

    expect(
      meeting?.participants.map(({ id, name, initials }) => [
        id,
        name,
        initials,
      ]),
    ).toEqual([
      ["ada", "Ada Lovelace", "AL"],
      ["lin", "Campus member", "?"],
      ["grace", "Grace Hopper", "GH"],
    ]);
    expect(meeting?.localParticipantId).toBe("ada");
    expect(meeting?.encounter).toBe(1);
  });

  it("skips anyone world names before they are known", () => {
    expect(meetingAfter(WELCOME, EVERYONE_HERE, nearby("stranger"))).toBeNull();
    expect(
      meetingAfter(
        WELCOME,
        EVERYONE_HERE,
        nearby("grace", "stranger"),
      )?.participants.map(({ id }) => id),
    ).toEqual(["ada", "grace"]);
  });

  it("gives each person the same tone whatever order they came in", () => {
    const tonesOf = (meeting: Meeting | null) =>
      Object.fromEntries(
        meeting?.participants.map(({ id, tone }) => [id, tone]) ?? [],
      );

    const together = meetingAfter(
      WELCOME,
      EVERYONE_HERE,
      nearby("grace", "lin"),
    );
    const oneThenOther = meetingAfter(
      WELCOME,
      EVERYONE_HERE,
      nearby("lin"),
      nearby("grace", "lin"),
    );

    expect(tonesOf(oneThenOther)).toEqual(tonesOf(together));
  });

  function inLibraryWith(
    spaces: { spaceKey: string; name: string }[],
    ...messages: ServerMessage[]
  ) {
    return meetingAfter(
      WELCOME,
      {
        type: "snapshot",
        map: { id: "campus", version: "v1", width: 60, height: 40 },
        players: [
          avatar("ada", "Ada Lovelace", "library"),
          avatar("grace", "Grace Hopper", "library"),
        ],
        spaces,
      },
      ...messages,
    );
  }

  const ROOM_CALL = callFrame("room");
  const LIBRARY = { spaceKey: "library", name: "Library" };

  it.each([
    ["proximity", [nearby("grace")], "Nearby"],
    ["room", [ROOM_CALL], "Library"],
  ] as const)(
    "titles a %s meeting for where you meet",
    (hearing, messages, title) => {
      expect(inLibraryWith([LIBRARY], ...messages)).toMatchObject({
        hearing,
        title,
      });
    },
  );

  it("titles a room World has not named with its key", () => {
    expect(inLibraryWith([], ROOM_CALL)?.title).toBe("library");
  });

  it("has no meeting while you are alone in a room", () => {
    expect(
      inLibraryWith([LIBRARY], ROOM_CALL, {
        type: "spaceChanged",
        userId: "grace",
        spaceKey: "_default",
      }),
    ).toBeNull();
  });
});

describe("splitAtCap", () => {
  it("shows up to the cap and counts the rest", () => {
    expect(splitAtCap(["a", "b", "c", "d", "e"], 3)).toEqual({
      shown: ["a", "b", "c"],
      remaining: 2,
    });
    expect(splitAtCap(["a", "b"], 3)).toEqual({
      shown: ["a", "b"],
      remaining: 0,
    });
  });
});

describe("visibleMeetingLayout", () => {
  const gridFocusedOnLin: OpenedMeetingLayout = {
    mode: "expanded",
    focusedTileId: "lin",
    encounter: 1,
  };

  it("shows the map for a grid opened in an earlier encounter", () => {
    expect(
      visibleMeetingLayout(gridFocusedOnLin, meetingWith(2, "ada", "lin")),
    ).toEqual({ mode: "compact" });
  });

  it("keeps the grid, and its focus while the focused person stays near", () => {
    expect(
      visibleMeetingLayout(gridFocusedOnLin, meetingWith(1, "ada", "lin")),
    ).toEqual({ mode: "expanded", focusedTileId: "lin" });
  });

  it("evens out the grid when the focused person walks away", () => {
    expect(
      visibleMeetingLayout(gridFocusedOnLin, meetingWith(1, "ada", "grace")),
    ).toEqual({ mode: "expanded", focusedTileId: null });
  });
});
