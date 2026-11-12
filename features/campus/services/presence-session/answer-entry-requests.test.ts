// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createPresenceStore } from "@/core/presence";
import type { Avatar, ServerMessage } from "@/core/realtime";

import {
  answerEntryRequests,
  type EntryAnswerToast,
} from "./answer-entry-requests";

function avatar(userId: string, displayName: string, spaceKey: string): Avatar {
  return {
    userId,
    x: 0,
    y: 0,
    facing: "down",
    displayName,
    spriteKey: null,
    status: "available",
    statusUntil: null,
    spaceKey,
  };
}

function start(selfSpace = "room_1") {
  const presence = createPresenceStore();
  const frames: ServerMessage[] = [
    {
      type: "welcome",
      userId: "me",
      connectionId: "c",
      heartbeatSeconds: 30,
      stepMs: 100,
      tickMs: 50,
      awayAfterSeconds: 600,
      displayName: "Me",
      spriteKey: null,
    },
    {
      type: "snapshot",
      map: { id: "campus", version: "v1", width: 20, height: 20 },
      players: [
        avatar("me", "Me", selfSpace),
        avatar("ada", "Ada Okafor", "_default"),
        avatar("bola", "Bola", "_default"),
      ],
      spaces: [{ spaceKey: "room_1", name: "Room 1" }],
      lockableSpaces: ["room_1"],
      lockedSpaces: ["room_1"],
    },
  ];
  frames.forEach((frame) => presence.getState().apply(frame));
  const show = vi.fn((_toast: EntryAnswerToast) => {});
  const close = vi.fn();
  const social = { sendAnswerEntryRequest: vi.fn(() => true) };
  const stop = answerEntryRequests({ close, presence, show, social });

  return {
    apply: (frame: ServerMessage) => presence.getState().apply(frame),
    close,
    shown: () => show.mock.calls.map(([toast]) => toast),
    social,
    stop,
  };
}

function knock(
  session: ReturnType<typeof start>,
  requestId = "r1",
  userId = "ada",
  spaceKey = "room_1",
) {
  session.apply({ type: "entryRequested", requestId, userId, spaceKey });
}

function ended(session: ReturnType<typeof start>, requestId = "r1") {
  session.apply({
    type: "entryRequestEnded",
    requestId,
    userId: "ada",
    spaceKey: "room_1",
    outcome: "admitted",
    answeredBy: "someone-else",
  });
}

describe("answerEntryRequests", () => {
  it("asks the member inside to answer, naming who knocks", () => {
    const session = start();

    knock(session);

    expect(session.shown()).toEqual([
      expect.objectContaining({
        askerId: "ada",
        askerName: "Ada",
        id: "entry-answer-r1",
      }),
    ]);
  });

  it.each([
    [true, "Let in"],
    [false, "Not now"],
  ])("sends admit: %s and closes the toast", (admit) => {
    const session = start();
    knock(session);

    session.shown()[0]!.onAnswer(admit);

    expect(session.social.sendAnswerEntryRequest).toHaveBeenCalledWith(
      "r1",
      admit,
    );
    expect(session.close).toHaveBeenCalledWith("entry-answer-r1");
  });

  it("shows one toast per request, side by side", () => {
    const session = start();

    knock(session, "r1", "ada");
    knock(session, "r2", "bola");

    expect(session.shown().map(({ id }) => id)).toEqual([
      "entry-answer-r1",
      "entry-answer-r2",
    ]);
  });

  it("closes quietly once someone else answers", () => {
    const session = start();
    knock(session);

    ended(session);

    expect(session.close).toHaveBeenCalledWith("entry-answer-r1");
    expect(session.social.sendAnswerEntryRequest).not.toHaveBeenCalled();
  });

  it("closes the toast when the member leaves the space", () => {
    const session = start();
    knock(session);

    session.apply({ type: "spaceChanged", userId: "me", spaceKey: "_default" });

    expect(session.close).toHaveBeenCalledWith("entry-answer-r1");
  });

  it("shows the request again when the member steps back in", () => {
    const session = start();
    knock(session);

    session.apply({ type: "spaceChanged", userId: "me", spaceKey: "_default" });
    session.apply({ type: "spaceChanged", userId: "me", spaceKey: "room_1" });

    expect(session.shown().map(({ id }) => id)).toEqual([
      "entry-answer-r1",
      "entry-answer-r1",
    ]);
  });

  it("keeps a closed toast closed through leaving and returning", () => {
    const session = start();
    knock(session);
    session.shown()[0]!.onClose();

    session.apply({ type: "spaceChanged", userId: "me", spaceKey: "_default" });
    session.apply({ type: "spaceChanged", userId: "me", spaceKey: "room_1" });

    expect(session.shown()).toHaveLength(1);
  });

  it("keeps the toast open and says so when the answer cannot be sent", () => {
    const session = start();
    knock(session);
    session.social.sendAnswerEntryRequest.mockReturnValueOnce(false);

    session.shown()[0]!.onAnswer(true);

    expect(session.close).not.toHaveBeenCalled();
    expect(session.shown()).toEqual([
      expect.objectContaining({ id: "entry-answer-r1", unsent: false }),
      expect.objectContaining({ id: "entry-answer-r1", unsent: true }),
    ]);

    session.shown()[1]!.onAnswer(true);

    expect(session.social.sendAnswerEntryRequest).toHaveBeenCalledTimes(2);
    expect(session.close).toHaveBeenCalledWith("entry-answer-r1");
  });

  it("never shows the member's own request", () => {
    const session = start("_default");

    knock(session, "r1", "me");

    expect(session.shown()).toEqual([]);
  });

  it("shows a request that was open before the member stepped in", () => {
    const session = start("_default");
    knock(session);
    expect(session.shown()).toEqual([]);

    session.apply({ type: "spaceChanged", userId: "me", spaceKey: "room_1" });

    expect(session.shown().map(({ id }) => id)).toEqual(["entry-answer-r1"]);
  });

  it("keeps a closed toast closed while its request stays open", () => {
    const session = start();
    knock(session);

    session.shown()[0]!.onClose();
    knock(session, "r2", "bola");

    expect(session.shown().map(({ id }) => id)).toEqual([
      "entry-answer-r1",
      "entry-answer-r2",
    ]);
  });

  it("closes every toast it showed when the session ends", () => {
    const session = start();
    knock(session);

    session.stop();

    expect(session.close).toHaveBeenCalledWith("entry-answer-r1");
  });
});
