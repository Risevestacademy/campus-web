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
      expect(parseServerMessage(frameText(frame))).toEqual({
        ok: true,
        message: frame,
      });
    },
  );

  it("drops a field the server adds later instead of rejecting the frame", () => {
    const frame = { ...serverFrames.left, sessionToken: "secret" };

    expect(parseServerMessage(frameText(frame))).toEqual({
      ok: true,
      message: serverFrames.left,
    });
  });

  it.each(["teleport", "constructor", "toString", "__proto__"])(
    "reports %j as a type the client does not know, so it can be skipped",
    (type) => {
      expect(parseServerMessage(frameText({ type, userId: "x" }))).toEqual({
        ok: false,
        reason: "unknown-type",
      });
    },
  );

  it("names a known frame that arrived corrupted, so a broken welcome is not mistaken for noise", () => {
    const { connectionId: _connectionId, ...welcome } = serverFrames.welcome;

    expect(parseServerMessage(frameText(welcome))).toEqual({
      ok: false,
      reason: "invalid",
      type: "welcome",
    });
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

    expect(parseServerMessage(frameText(frame))).toEqual({
      ok: false,
      reason: "invalid",
      type: "moved",
    });
  });

  it("refuses an avatar whose nullable name is missing rather than null", () => {
    const { displayName: _displayName, ...player } = serverFrames.joined.player;

    expect(parseServerMessage(frameText({ type: "joined", player }))).toEqual({
      ok: false,
      reason: "invalid",
      type: "joined",
    });
  });

  it("refuses a facing the protocol does not define", () => {
    const frame = {
      ...serverFrames.moveResult,
      player: { ...serverFrames.moveResult.player, facing: "north" },
    };

    expect(parseServerMessage(frameText(frame))).toEqual({
      ok: false,
      reason: "invalid",
      type: "moveResult",
    });
  });

  it("reads an outcome world added after the last world:types as unknown, so the move it answers still resolves", () => {
    const frame = { ...serverFrames.moveResult, outcome: "teleported" };

    expect(parseServerMessage(frameText(frame))).toEqual({
      ok: true,
      message: { ...serverFrames.moveResult, outcome: "unknown" },
    });
  });

  it("reads an error code world added after the last world:types as unknown", () => {
    const frame = { ...serverFrames.error, code: "RATE_LIMITED" };

    expect(parseServerMessage(frameText(frame))).toEqual({
      ok: true,
      message: { ...serverFrames.error, code: "unknown" },
    });
  });

  it.each([
    ["no outcome", undefined],
    ["a numeric outcome", 2],
  ])("refuses a moveResult with %s", (_case, outcome) => {
    const frame = { ...serverFrames.moveResult, outcome };

    expect(parseServerMessage(frameText(frame))).toEqual({
      ok: false,
      reason: "invalid",
      type: "moveResult",
    });
  });

  it.each(["", "not json", "[]", "null", '{"type":5}', '{"userId":"x"}'])(
    "reads %j as an invalid frame with no type",
    (text) => {
      expect(parseServerMessage(text)).toEqual({
        ok: false,
        reason: "invalid",
      });
    },
  );
});
