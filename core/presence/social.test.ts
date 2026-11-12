import { describe, expect, it } from "vitest";

import type { ServerMessage } from "@/core/realtime";
import { serverFrames } from "@/tests/fixtures/world-frames";

import {
  applyServerMessage,
  EMPTY_PRESENCE,
  type Presence,
  withoutRemoteParticipants,
} from "./presence";
import {
  CHAT_LINE_LIMIT,
  ENTRY_OUTCOME_LIMIT,
  ERROR_LIMIT,
  STAFF_ACTION_LIMIT,
} from "./social";

function applied(...messages: ServerMessage[]): Presence {
  return messages.reduce(applyServerMessage, EMPTY_PRESENCE);
}

const said = (id: string, text = "Hello"): ServerMessage => ({
  ...serverFrames.said,
  id,
  text,
});
const asked = (requestId: string): ServerMessage => ({
  ...serverFrames.entryRequested,
  requestId,
});
const ended = (
  requestId: string,
  outcome: "admitted" | "declined" = "admitted",
): ServerMessage => ({
  ...serverFrames.entryRequestEnded,
  requestId,
  outcome,
});

describe("locks", () => {
  it("start from the snapshot's lists", () => {
    const presence = applied(serverFrames.welcome, {
      ...serverFrames.snapshot,
      lockableSpaces: ["library", "studio"],
      lockedSpaces: ["library"],
    });

    expect(presence.lockableSpaces).toEqual(["library", "studio"]);
    expect(presence.lockedSpaces).toEqual(["library"]);
  });

  it("read as none when the snapshot names none", () => {
    const {
      lockableSpaces: _a,
      lockedSpaces: _b,
      ...bare
    } = serverFrames.snapshot;

    const presence = applied(serverFrames.welcome, bare);

    expect(presence.lockableSpaces).toEqual([]);
    expect(presence.lockedSpaces).toEqual([]);
  });

  it("lock and unlock as lockChanged says, without listing a space twice", () => {
    const lock = (locked: boolean): ServerMessage => ({
      ...serverFrames.lockChanged,
      spaceKey: "library",
      locked,
    });

    expect(applied(lock(true), lock(true)).lockedSpaces).toEqual(["library"]);
    expect(applied(lock(true), lock(false)).lockedSpaces).toEqual([]);
  });

  it("replace the lockable list when an admin changes a space", () => {
    const presence = applied({
      ...serverFrames.lockableSpaces,
      spaceKeys: ["studio"],
    });

    expect(presence.lockableSpaces).toEqual(["studio"]);
  });

  it("start over with the next snapshot, after a reconnect", () => {
    const first = applied(serverFrames.welcome, {
      ...serverFrames.snapshot,
      lockedSpaces: ["library"],
    });

    const second = applyServerMessage(first, {
      ...serverFrames.snapshot,
      lockedSpaces: [],
    });

    expect(second.lockedSpaces).toEqual([]);
  });
});

describe("chat", () => {
  it("keeps what is said, in the order it arrives", () => {
    const presence = applied(said("a", "First"), said("b", "Second"));

    expect(presence.chat.map(({ text }) => text)).toEqual(["First", "Second"]);
    expect(presence.chat[0]).toEqual({
      id: "a",
      userId: serverFrames.said.userId,
      spaceKey: serverFrames.said.spaceKey,
      text: "First",
      at: serverFrames.said.at,
    });
  });

  it("ignores a line it already has", () => {
    const once = applied(said("a"));

    expect(applyServerMessage(once, said("a"))).toBe(once);
  });

  it("keeps only the newest lines", () => {
    const lines = Array.from({ length: CHAT_LINE_LIMIT + 5 }, (_, index) =>
      said(String(index)),
    );

    const presence = applied(...lines);

    expect(presence.chat).toHaveLength(CHAT_LINE_LIMIT);
    expect(presence.chat[0]?.id).toBe("5");
    expect(presence.chat.at(-1)?.id).toBe(String(CHAT_LINE_LIMIT + 4));
  });

  it("survives a reconnect's snapshot, which world never resends", () => {
    const before = applied(said("a"));

    const after = applyServerMessage(before, serverFrames.snapshot);

    expect(after.chat).toHaveLength(1);
  });
});

describe("entry requests", () => {
  it("are open until they end, and not listed twice", () => {
    const presence = applied(asked("r1"), asked("r1"), asked("r2"));

    expect(presence.entryRequests.map(({ requestId }) => requestId)).toEqual([
      "r1",
      "r2",
    ]);
  });

  it("move to the outcomes when they end, with how they ended", () => {
    const presence = applied(asked("r1"), asked("r2"), ended("r1", "declined"));

    expect(presence.entryRequests.map(({ requestId }) => requestId)).toEqual([
      "r2",
    ]);
    expect(presence.entryOutcomes).toEqual([
      {
        requestId: "r1",
        userId: serverFrames.entryRequestEnded.userId,
        spaceKey: serverFrames.entryRequestEnded.spaceKey,
        outcome: "declined",
        answeredBy: serverFrames.entryRequestEnded.answeredBy,
      },
    ]);
  });

  it("record an outcome for a request this client never saw open", () => {
    expect(applied(ended("late")).entryOutcomes).toHaveLength(1);
  });

  it("keep only the newest outcomes", () => {
    const outcomes = Array.from(
      { length: ENTRY_OUTCOME_LIMIT + 3 },
      (_, index) => ended(String(index)),
    );

    const presence = applied(...outcomes);

    expect(presence.entryOutcomes).toHaveLength(ENTRY_OUTCOME_LIMIT);
    expect(presence.entryOutcomes[0]?.requestId).toBe("3");
  });

  it("end with the socket they were sent to", () => {
    const open = applied(
      serverFrames.welcome,
      serverFrames.snapshot,
      asked("r1"),
    );

    expect(withoutRemoteParticipants(open).entryRequests).toEqual([]);
    expect(
      applyServerMessage(open, serverFrames.snapshot).entryRequests,
    ).toEqual([]);
  });

  it("take the broadcast room with the socket, which world sends again on arrival", () => {
    const presence = applied(
      serverFrames.welcome,
      serverFrames.snapshot,
      serverFrames.broadcast,
    );
    expect(presence.broadcast).not.toBeNull();

    expect(withoutRemoteParticipants(presence).broadcast).toBeNull();
  });

  it("leave the outcomes the member has not yet seen when the socket closes", () => {
    const presence = applied(
      serverFrames.welcome,
      serverFrames.snapshot,
      asked("r1"),
      ended("r1"),
    );

    expect(withoutRemoteParticipants(presence).entryOutcomes).toHaveLength(1);
  });
});

describe("staff actions", () => {
  const action = (userId: string): ServerMessage => ({
    ...serverFrames.staffAction,
    userId,
  });

  it("are numbered so a view can tell a new one from one it has shown", () => {
    const presence = applied(action("a"), action("a"), action("b"));

    expect(presence.staffActions.map(({ seq }) => seq)).toEqual([1, 2, 3]);
    expect(presence.staffActions[2]).toEqual({
      seq: 3,
      action: serverFrames.staffAction.action,
      userId: "b",
      by: serverFrames.staffAction.by,
      spaceKey: serverFrames.staffAction.spaceKey,
      until: serverFrames.staffAction.until,
      player: serverFrames.staffAction.player,
    });
  });

  it("keep only the newest, counting on", () => {
    const actions = Array.from({ length: STAFF_ACTION_LIMIT + 2 }, () =>
      action("a"),
    );

    const presence = applied(...actions);

    expect(presence.staffActions).toHaveLength(STAFF_ACTION_LIMIT);
    expect(presence.staffActions.at(-1)?.seq).toBe(STAFF_ACTION_LIMIT + 2);
  });
});

describe("errors", () => {
  const refused = (message: string): ServerMessage => ({
    type: "error",
    code: "NOT_ALLOWED",
    message,
  });

  it("are kept, numbered, for a feature that is waiting on an answer", () => {
    const presence = applied(refused("a"), refused("b"));

    expect(presence.errors).toEqual([
      { seq: 1, code: "NOT_ALLOWED", message: "a" },
      { seq: 2, code: "NOT_ALLOWED", message: "b" },
    ]);
  });

  it("keep only the newest, counting on", () => {
    const errors = Array.from({ length: ERROR_LIMIT + 3 }, (_, index) =>
      refused(String(index)),
    );

    const presence = applied(...errors);

    expect(presence.errors).toHaveLength(ERROR_LIMIT);
    expect(presence.errors.at(-1)?.seq).toBe(ERROR_LIMIT + 3);
  });
});

describe("broadcast and desks", () => {
  it("holds the broadcast room and whether the member may speak, never the token", () => {
    const { call } = serverFrames.broadcast;
    const on = applied(serverFrames.broadcast);

    expect(on.broadcast).toEqual({
      room: call!.room,
      canSpeak: call!.canSpeak,
    });
    expect(JSON.stringify(on)).not.toContain(call!.token);
    expect(JSON.stringify(on)).not.toContain(call!.url);
    expect(
      applyServerMessage(on, { type: "broadcast", call: null }).broadcast,
    ).toBeNull();
  });

  it("counts each desksChanged, the cue to fetch the desks again", () => {
    const presence = applied(
      serverFrames.desksChanged,
      serverFrames.desksChanged,
    );

    expect(presence.desksVersion).toBe(2);
  });
});

it("leaves the social state alone for a frame that is not about it", () => {
  const before = applied(serverFrames.welcome, serverFrames.snapshot);

  const after = applyServerMessage(before, serverFrames.nearby);

  expect(after.chat).toBe(before.chat);
  expect(after.entryRequests).toBe(before.entryRequests);
  expect(after.lockedSpaces).toBe(before.lockedSpaces);
});
