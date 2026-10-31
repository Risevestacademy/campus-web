import { describe, expect, it } from "vitest";

import {
  applyServerMessage,
  EMPTY_PRESENCE,
  type Presence,
} from "@/core/presence";
import type { Avatar } from "@/core/realtime";

import { buildAvatarDrawList } from "./avatar-draw-list";

const TILE = { tilewidth: 16, tileheight: 16 };

function presenceOf(selfId: string | null, ...players: Avatar[]): Presence {
  const placed = applyServerMessage(EMPTY_PRESENCE, {
    type: "snapshot",
    map: { id: "campus", version: "v1", width: 60, height: 40 },
    players,
    spaces: [],
  });
  return { ...placed, selfId };
}

function avatar(
  userId: string,
  x: number,
  y: number,
  displayName: string | null = null,
): Avatar {
  return {
    userId,
    x,
    y,
    facing: "down",
    displayName,
    spriteKey: null,
    status: "available",
    spaceKey: "_default",
  };
}

describe("buildAvatarDrawList", () => {
  it("places each person at the centre of their tile, with an escaped label", () => {
    const list = buildAvatarDrawList(
      presenceOf(
        "ada",
        avatar("ada", 2, 3, "Ada"),
        avatar("grace", 0, 0, "[b]Grace"),
      ),
      TILE,
    );

    expect(list).toEqual([
      {
        userId: "grace",
        x: 8,
        y: 8,
        facing: "down",
        label: "\\[b]Grace",
        isSelf: false,
      },
      {
        userId: "ada",
        x: 40,
        y: 56,
        facing: "down",
        label: "Ada",
        isSelf: true,
      },
    ]);
  });

  it("draws a nearer avatar after a farther one, so it overlaps", () => {
    const list = buildAvatarDrawList(
      presenceOf(
        null,
        avatar("near", 1, 9),
        avatar("far", 1, 2),
        avatar("middle", 5, 5),
      ),
      TILE,
    );

    expect(list.map(({ userId }) => userId)).toEqual(["far", "middle", "near"]);
  });

  it("draws no label for someone with no display name", () => {
    const [entry] = buildAvatarDrawList(
      presenceOf(null, avatar("grace", 0, 0)),
      TILE,
    );

    expect(entry?.label).toBeNull();
  });

  it("draws nobody it has no position for", () => {
    const presence = presenceOf(null, avatar("grace", 0, 0));

    const list = buildAvatarDrawList(
      { ...presence, positions: new Map() },
      TILE,
    );

    expect(list).toEqual([]);
  });

  it("draws self from KAPLAY's interpolated position", () => {
    const presence = presenceOf("ada", avatar("ada", 2, 3));

    const [self] = buildAvatarDrawList(presence, TILE, {
      self: {
        userId: "ada",
        x: 2.5,
        y: 3,
        facing: "right",
      },
    });

    expect(self).toEqual(
      expect.objectContaining({ x: 48, y: 56, facing: "right" }),
    );
  });

  it("draws a remote from KAPLAY's interpolated position", () => {
    const presence = presenceOf(
      "ada",
      avatar("ada", 2, 3),
      avatar("grace", 0, 0, "Grace"),
    );

    const grace = buildAvatarDrawList(presence, TILE, {
      remotes: new Map([
        [
          "grace",
          {
            userId: "grace",
            x: 0.5,
            y: 0,
            facing: "right" as const,
          },
        ],
      ]),
    }).find(({ userId }) => userId === "grace");

    expect(grace).toEqual(
      expect.objectContaining({ x: 16, y: 8, facing: "right" }),
    );
  });
});
