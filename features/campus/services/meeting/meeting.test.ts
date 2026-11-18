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
import {
  meetingGridShape,
  meetingTiles,
  selectMeeting,
  splitAtCap,
  tileVideoLayer,
  visibleMeetingLayout,
} from "./meeting";

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
    statusUntil: null,
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
  awayAfterSeconds: 600,
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
      initial: "?",
      name: id,
      avatarClassName: "bg-cobalt-300 text-cobalt-950",
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
      meeting?.participants.map(({ id, name, initial }) => [id, name, initial]),
    ).toEqual([
      ["ada", "Ada Lovelace", "A"],
      ["lin", "Campus member", "C"],
      ["grace", "Grace Hopper", "G"],
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
        meeting?.participants.map(({ id, avatarClassName }) => [
          id,
          avatarClassName,
        ]) ?? [],
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

describe("meetingGridShape", () => {
  it.each([
    [1, 1, 1],
    [2, 2, 1],
    [3, 2, 2],
    [4, 2, 2],
    [5, 3, 2],
    [7, 3, 3],
    [10, 4, 3],
  ])("fits %i tiles in %i columns and %i rows", (tiles, columns, rows) => {
    expect(meetingGridShape(tiles)).toEqual({ columns, rows });
  });
});

describe("meetingTiles", () => {
  const tilesOf = (sharerIds: readonly string[], isSharing = false) =>
    meetingTiles(
      meetingWith(1, "ada", "grace", "lin"),
      new Set(sharerIds),
      isSharing,
    );
  const tileIds = (sharerIds: readonly string[], isSharing = false) =>
    tilesOf(sharerIds, isSharing).map(({ id }) => id);

  it.each([
    ["one tile per person while nobody shares", [], []],
    ["a share first, beside its owner's own tile", ["lin"], ["screen:lin"]],
    [
      "a tile for everyone who shares",
      ["lin", "grace"],
      ["screen:grace", "screen:lin"],
    ],
    ["no tile for the member's own id among the others' shares", ["ada"], []],
    ["no tile for a share by someone not met", ["maya"], []],
  ])("has %s", (_case, sharers, screens) => {
    expect(tileIds(sharers)).toEqual([...screens, "ada", "grace", "lin"]);
  });

  it.each([
    [
      "ahead of everyone else's",
      ["lin"],
      ["screen:ada", "screen:lin", "ada", "grace", "lin"],
    ],
    ["only once", ["ada"], ["screen:ada", "ada", "grace", "lin"]],
  ])("has the member's own share %s", (_case, sharers, tiles) => {
    expect(tileIds(sharers, true)).toEqual(tiles);
  });

  it("marks the member's own share apart from the shares they receive", () => {
    expect(
      tilesOf(["lin"], true)
        .slice(0, 2)
        .map(({ kind }) => kind),
    ).toEqual(["own-screen", "screen"]);
  });
});

describe("visibleMeetingLayout", () => {
  const gridFocusedOn = (focusedTileId: string): OpenedMeetingLayout => ({
    mode: "expanded",
    focusedTileId,
    encounter: 1,
  });

  function layoutOf(
    layout: OpenedMeetingLayout,
    encounter: number,
    people: readonly string[],
    sharing: readonly string[] = [],
  ) {
    const meeting = meetingWith(encounter, ...people);
    return visibleMeetingLayout(
      layout,
      encounter,
      meetingTiles(meeting, new Set(sharing), false),
    );
  }

  it("shows the map for a grid opened in an earlier encounter", () => {
    expect(layoutOf(gridFocusedOn("lin"), 2, ["ada", "lin"])).toEqual({
      mode: "compact",
    });
  });

  it("keeps the grid, and its focus while the focused person stays near", () => {
    expect(layoutOf(gridFocusedOn("lin"), 1, ["ada", "lin"])).toEqual({
      mode: "expanded",
      focusedTileId: "lin",
    });
  });

  it("evens out the grid when the focused person walks away", () => {
    expect(layoutOf(gridFocusedOn("lin"), 1, ["ada", "grace"])).toEqual({
      mode: "expanded",
      focusedTileId: null,
    });
  });

  it("keeps the focus on a share while it runs", () => {
    expect(
      layoutOf(gridFocusedOn("screen:lin"), 1, ["ada", "lin"], ["lin"]),
    ).toEqual({ mode: "expanded", focusedTileId: "screen:lin" });
  });

  it("evens out the grid when the focused share ends", () => {
    expect(layoutOf(gridFocusedOn("screen:lin"), 1, ["ada", "lin"])).toEqual({
      mode: "expanded",
      focusedTileId: null,
    });
  });
});

describe("tileVideoLayer", () => {
  it.each([
    ["a compact tile", { mode: "compact" }, "low"],
    ["an equal grid cell", { mode: "expanded", focusedTileId: null }, "medium"],
    ["the focused tile", { mode: "expanded", focusedTileId: "grace" }, "high"],
    [
      "a thumbnail beside the focus",
      { mode: "expanded", focusedTileId: "lin" },
      "low",
    ],
  ] as const)("gives %s the layer its size needs", (_case, layout, layer) => {
    expect(tileVideoLayer(layout, "grace")).toBe(layer);
  });

  it("tells a focused share from its owner's own tile", () => {
    const layout = { mode: "expanded", focusedTileId: "screen:grace" } as const;

    expect(tileVideoLayer(layout, "screen:grace")).toBe("high");
    expect(tileVideoLayer(layout, "grace")).toBe("low");
  });
});
