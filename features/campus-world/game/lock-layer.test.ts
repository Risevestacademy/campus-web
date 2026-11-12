import type { Space } from "campus-world-map";
import type { KAPLAYOpt } from "kaplay";
import { describe, expect, it } from "vitest";

import { createPresenceStore } from "@/core/presence";
import type { Avatar, ServerMessage } from "@/core/realtime";

import { fakeKaplay } from "../testing/fake-kaplay";
import { addLockLayers } from "./lock-layer";

const MAP = { tileheight: 16, tilewidth: 16 };
const ROOM: Space = {
  key: "room_1",
  name: "room_1",
  kind: "meeting_room",
  bounds: { shape: "rect", x: 2, y: 2, width: 4, height: 3 },
  properties: {},
};

function avatar(userId: string, spaceKey: string): Avatar {
  return {
    userId,
    x: 0,
    y: 0,
    facing: "down",
    displayName: userId,
    spriteKey: null,
    status: "available",
    statusUntil: null,
    spaceKey,
  };
}

function startLayers(selfSpace: string, lockedSpaces: string[]) {
  const fake = fakeKaplay({ autoDraw: false });
  fake.kaplay({} as KAPLAYOpt);
  const context = fake.contexts[0]!;
  const presence = createPresenceStore();
  const frames: ServerMessage[] = [
    {
      type: "welcome",
      userId: "ada",
      connectionId: "c",
      heartbeatSeconds: 30,
      stepMs: 100,
      tickMs: 50,
      awayAfterSeconds: 600,
      displayName: "Ada",
      spriteKey: null,
    },
    {
      type: "snapshot",
      map: { id: "campus", version: "v1", width: 20, height: 20 },
      players: [avatar("ada", selfSpace)],
      spaces: [{ spaceKey: "room_1", name: "Room 1" }],
      lockableSpaces: ["room_1"],
      lockedSpaces,
    },
  ];
  frames.forEach((frame) => presence.getState().apply(frame));
  addLockLayers(context.k, {
    map: MAP,
    readPresence: presence.getState,
    spaces: [ROOM],
  });
  context.drawFrame();
  return { k: context.k, presence };
}

describe("addLockLayers", () => {
  it("draws nothing over an unlocked room", () => {
    const { k } = startLayers("_default", []);

    expect(k.drawPolygon).not.toHaveBeenCalled();
    expect(k.drawFormattedText).not.toHaveBeenCalled();
  });

  it("hatches a locked room and names it on a plate", () => {
    const { k } = startLayers("_default", ["room_1"]);

    expect(k.drawPolygon).toHaveBeenCalledTimes(1);
    expect(k.drawLine).toHaveBeenCalled();
    expect(k.formatText).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Room 1" }),
    );
    expect(k.drawFormattedText).toHaveBeenCalledTimes(1);
  });

  it("shows the room as normal to whoever is inside it", () => {
    const { k } = startLayers("room_1", ["room_1"]);

    expect(k.drawPolygon).not.toHaveBeenCalled();
    expect(k.drawFormattedText).not.toHaveBeenCalled();
  });
});
