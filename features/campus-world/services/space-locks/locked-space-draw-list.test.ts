// @vitest-environment node

import type { Space } from "campus-world-map";
import { describe, expect, it } from "vitest";

import { EMPTY_PRESENCE, type Presence } from "@/core/presence";

import {
  buildLockedSpaceDrawList,
  hatchSegments,
} from "./locked-space-draw-list";

const TILE = { tilewidth: 32, tileheight: 32 };

function rectSpace(key: string, x: number, y: number): Space {
  return {
    key,
    name: key,
    kind: "meeting_room",
    bounds: { shape: "rect", x, y, width: 4, height: 3 },
    properties: {},
  };
}

const SPACES: Space[] = [
  rectSpace("room_1", 0, 0),
  rectSpace("room_2", 10, 0),
  {
    key: "lounge",
    name: "lounge",
    kind: null,
    bounds: {
      shape: "polygon",
      points: [
        { x: 0, y: 10 },
        { x: 4, y: 10 },
        { x: 2, y: 14 },
      ],
    },
    properties: {},
  },
];

function presenceIn(
  spaceKey: string,
  lockedSpaces: string[],
): Pick<Presence, "selfId" | "participants" | "lockedSpaces" | "spaceNames"> {
  return {
    ...EMPTY_PRESENCE,
    selfId: "ada",
    participants: new Map([
      [
        "ada",
        {
          userId: "ada",
          displayName: "Ada",
          spriteKey: null,
          status: "available",
          statusUntil: null,
          spaceKey,
        },
      ],
    ]),
    lockedSpaces,
    spaceNames: new Map([["room_2", "Room [2]"]]),
  };
}

describe("buildLockedSpaceDrawList", () => {
  it("draws nothing while no space is locked", () => {
    expect(
      buildLockedSpaceDrawList(SPACES, presenceIn("_default", []), TILE),
    ).toEqual([]);
  });

  it("outlines a locked room in pixels, with its plate on the bottom edge", () => {
    const [draw] = buildLockedSpaceDrawList(
      SPACES,
      presenceIn("_default", ["room_2"]),
      TILE,
    );

    expect(draw).toEqual({
      key: "room_2",
      outline: [
        { x: 320, y: 0 },
        { x: 448, y: 0 },
        { x: 448, y: 96 },
        { x: 320, y: 96 },
      ],
      hatched: true,
      plate: { x: 384, y: 96 },
      label: "Room \\[2]",
    });
  });

  it("leaves out the locked room the member stands in", () => {
    expect(
      buildLockedSpaceDrawList(
        SPACES,
        presenceIn("room_2", ["room_1", "room_2"]),
        TILE,
      ).map(({ key }) => key),
    ).toEqual(["room_1"]);
  });

  it("shades a polygon without hatching, its plate under its lowest point", () => {
    const [draw] = buildLockedSpaceDrawList(
      SPACES,
      presenceIn("_default", ["lounge"]),
      TILE,
    );

    expect(draw).toMatchObject({
      hatched: false,
      plate: { x: 64, y: 448 },
      label: "lounge",
    });
  });
});

describe("hatchSegments", () => {
  const box = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 20 },
    { x: 0, y: 20 },
  ];

  it("keeps every line inside the box", () => {
    for (const { from, to } of hatchSegments(box, 8)) {
      for (const { x, y } of [from, to]) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(40);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(20);
      }
    }
  });

  it("spaces the lines evenly across the box", () => {
    expect(hatchSegments(box, 8)).toHaveLength(7);
    expect(hatchSegments(box, 8)[0]).toEqual({
      from: { x: 0, y: 8 },
      to: { x: 8, y: 0 },
    });
  });
});
