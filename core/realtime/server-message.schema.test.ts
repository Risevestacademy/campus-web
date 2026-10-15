// @vitest-environment node

import { describe, expect, it } from "vitest";

import { serverFrames } from "@/tests/fixtures/world-frames";

import { parseServerMessage } from "./server-message.schema";

function frameText(value: unknown): string {
  return JSON.stringify(value);
}

describe("parseServerMessage", () => {
  it.each(Object.values(serverFrames))(
    "reads a $type frame as the server sent it",
    (frame) => {
      expect(parseServerMessage(frameText(frame))).toEqual(frame);
    },
  );

  it("drops a field the server adds later instead of rejecting the frame", () => {
    const frame = { ...serverFrames.left, sessionToken: "secret" };

    expect(parseServerMessage(frameText(frame))).toEqual(serverFrames.left);
  });

  it("ignores a message type the client does not know", () => {
    expect(
      parseServerMessage(frameText({ type: "teleport", userId: "x" })),
    ).toBeUndefined();
  });

  it.each([
    ["a negative tile", -1],
    ["a fractional tile", 1.5],
    ["a tile past the safe integer range", 2 ** 53],
  ])("refuses a player on %s", (_case, x) => {
    const frame = {
      ...serverFrames.moved,
      players: [{ ...serverFrames.moved.players[0], x }],
    };

    expect(parseServerMessage(frameText(frame))).toBeUndefined();
  });

  it("refuses an avatar whose nullable name is missing rather than null", () => {
    const { displayName: _displayName, ...player } = serverFrames.joined.player;

    expect(
      parseServerMessage(frameText({ type: "joined", player })),
    ).toBeUndefined();
  });

  it("refuses a facing the protocol does not define", () => {
    const frame = {
      ...serverFrames.moveResult,
      player: { ...serverFrames.moveResult.player, facing: "north" },
    };

    expect(parseServerMessage(frameText(frame))).toBeUndefined();
  });

  it.each(["", "not json", "[]", "null"])("reads %j as no message", (text) => {
    expect(parseServerMessage(text)).toBeUndefined();
  });
});
