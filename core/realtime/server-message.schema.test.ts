// @vitest-environment node

import { describe, expect, it } from "vitest";

import { serverFrames } from "@/tests/fixtures/world-frames";

import {
  parseServerMessage,
  type ServerMessage,
} from "./server-message.schema";

function frameText(value: unknown): string {
  return JSON.stringify(value);
}

const { awayAfterSeconds: _awayAfterSeconds, ...welcome } =
  serverFrames.welcome;
const {
  lockableSpaces: _lockableSpaces,
  lockedSpaces: _lockedSpaces,
  ...snapshot
} = serverFrames.snapshot;
const {
  room: _room,
  subscribeRadius: _subscribeRadius,
  ...call
} = serverFrames.call.call!;

// Each frame as the parser hands it on: unread fields dropped, and a frame no
// feature reads yet cut down to its type.
const framesAsRead = {
  ...serverFrames,
  welcome,
  snapshot,
  call: { type: "call", call },
  nearby: serverFrames.nearby,
  lockChanged: { type: "lockChanged" },
  lockableSpaces: { type: "lockableSpaces" },
  broadcast: { type: "broadcast" },
  entryRequested: { type: "entryRequested" },
  entryRequestEnded: { type: "entryRequestEnded" },
  said: { type: "said" },
  staffAction: { type: "staffAction" },
  walking: { type: "walking" },
  walkEnded: { type: "walkEnded" },
} satisfies {
  [Type in ServerMessage["type"]]: Extract<ServerMessage, { type: Type }>;
};

describe("parseServerMessage", () => {
  it.each(Object.values(serverFrames))(
    "reads a $type frame keeping exactly what the client reads",
    (frame) => {
      expect(parseServerMessage(frameText(frame))).toEqual({
        ok: true,
        message: framesAsRead[frame.type],
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

  it.each(["moved", "blocked", "refused", "too_fast"] as const)(
    "reads a %s outcome as world sent it",
    (outcome) => {
      const frame = { ...serverFrames.moveResult, outcome };

      expect(parseServerMessage(frameText(frame))).toEqual({
        ok: true,
        message: frame,
      });
    },
  );

  it("reads a NOT_ALLOWED error as world sent it", () => {
    const frame = { ...serverFrames.error, code: "NOT_ALLOWED" as const };

    expect(parseServerMessage(frameText(frame))).toEqual({
      ok: true,
      message: frame,
    });
  });

  it("reads an outcome world added after the last world:types as unknown, so the move it answers still resolves", () => {
    const frame = { ...serverFrames.moveResult, outcome: "teleported" };

    expect(parseServerMessage(frameText(frame))).toEqual({
      ok: true,
      message: { ...serverFrames.moveResult, outcome: "unknown" },
    });
  });

  it("reads a hearing world added after the last world:types as unknown, so the proximity room leaves", () => {
    const frame = {
      ...serverFrames.call,
      call: { ...serverFrames.call.call, hearing: "stage" },
    };

    expect(parseServerMessage(frameText(frame))).toEqual({
      ok: true,
      message: { type: "call", call: { ...call, hearing: "unknown" } },
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

  it.each([
    ["no list", undefined],
    ["one id instead of a list", "grace"],
    ["a numeric id", [5]],
  ])("refuses a nearby with %s", (_case, userIds) => {
    const frame = { ...serverFrames.nearby, userIds };

    expect(parseServerMessage(frameText(frame))).toEqual({
      ok: false,
      reason: "invalid",
      type: "nearby",
    });
  });

  it("reads a null call so the active media room can leave", () => {
    const frame = { type: "call", call: null } as const;

    expect(parseServerMessage(frameText(frame))).toEqual({
      ok: true,
      message: frame,
    });
  });

  it.each([
    ["a negative audible radius", { audibleRadius: -1 }],
    ["an empty token", { token: "" }],
    ["an empty media url", { url: "" }],
  ])("refuses a call with %s", (_case, overrides) => {
    const frame = {
      ...serverFrames.call,
      call: { ...serverFrames.call.call, ...overrides },
    };

    expect(parseServerMessage(frameText(frame))).toEqual({
      ok: false,
      reason: "invalid",
      type: "call",
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
