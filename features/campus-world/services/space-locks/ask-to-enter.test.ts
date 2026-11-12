// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createPresenceStore } from "@/core/presence";
import type { Avatar, ServerMessage } from "@/core/realtime";

import {
  ANSWER_WAIT_MS,
  ASK_AGAIN_AFTER_S,
  type AskToEnterPorts,
  createAskToEnter,
  ENTRY_TOAST_ID,
} from "./ask-to-enter";

type Shown = Parameters<AskToEnterPorts["show"]>[0];

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

function start({ sent = true, steps = true } = {}) {
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
      players: [
        avatar("ada", "Ada", "_default"),
        avatar("tolu", "Tolu", "room_1"),
        avatar("kemi", "Kemi", "room_1"),
      ],
      spaces: [{ spaceKey: "room_1", name: "Room 1" }],
      lockableSpaces: ["room_1"],
      lockedSpaces: ["room_1"],
    },
  ];
  frames.forEach((frame) => presence.getState().apply(frame));

  let wait: (() => void) | undefined;
  const social = {
    sendRequestEntry: vi.fn(() => sent),
    sendWithdrawEntryRequest: vi.fn(() => true),
  };
  const stepInto = vi.fn(() => steps);
  const show = vi.fn((_toast: Shown) => {});
  const closeToast = vi.fn((_id: string) => {});
  const flow = createAskToEnter({
    close: closeToast,
    presence,
    setTimer: (run) => {
      wait = run;
      return () => {
        wait = undefined;
      };
    },
    show,
    social,
    stepInto,
  });

  return {
    apply: (frame: ServerMessage) => presence.getState().apply(frame),
    close: () => presence.getState().clearRemoteParticipants(),
    closeToast,
    elapse: () => wait?.(),
    flow,
    lastToast: () => show.mock.lastCall![0],
    show,
    social,
    stepInto,
  };
}

function askAtRoom(session: ReturnType<typeof start>) {
  session.flow.refused({ mayAsk: null, spaceKey: "room_1" });
  session.lastToast().actions![0]!.onClick();
}

function echo(session: ReturnType<typeof start>) {
  session.apply({
    type: "entryRequested",
    requestId: "r1",
    userId: "ada",
    spaceKey: "room_1",
  });
}

function end(
  session: ReturnType<typeof start>,
  outcome: Extract<ServerMessage, { type: "entryRequestEnded" }>["outcome"],
  answeredBy: string | null = outcome === "admitted" ? "tolu" : null,
) {
  session.apply({
    type: "entryRequestEnded",
    requestId: "r1",
    userId: "ada",
    spaceKey: "room_1",
    outcome,
    answeredBy,
  });
}

describe("createAskToEnter", () => {
  it("offers to ask at a locked room, and stays until answered or closed", () => {
    const session = start();

    session.flow.refused({ mayAsk: null, spaceKey: "room_1" });

    expect(session.lastToast()).toMatchObject({
      id: ENTRY_TOAST_ID,
      look: "locked",
      title: "Room 1 is locked",
      description: "Someone inside can let you in",
      timeout: 0,
      actions: [{ label: "Ask to enter" }],
    });
  });

  it("only tells the member when world says asking would not be taken", () => {
    const session = start();

    session.flow.refused({ mayAsk: false, spaceKey: "room_1" });

    expect(session.lastToast()).toMatchObject({ title: "Room 1 is locked" });
    expect(session.lastToast().actions).toBeUndefined();
    expect(session.lastToast().timeout).toBeUndefined();
  });

  it("only tells the member at a room that a step was refused but no lock keeps", () => {
    const session = start();

    session.flow.refused({ mayAsk: null, spaceKey: "library" });

    expect(session.lastToast()).toMatchObject({
      look: "refused",
      title: "You can't enter library",
    });
    expect(session.lastToast().actions).toBeUndefined();
    expect(session.lastToast().timeout).toBeUndefined();
  });

  it("offers to ask at an unlocked room when world says asking would be taken", () => {
    const session = start();

    session.flow.refused({ mayAsk: true, spaceKey: "library" });

    expect(session.lastToast()).toMatchObject({
      look: "refused",
      actions: [{ label: "Ask to enter" }],
    });
  });

  it("asks, and waits to be let in", () => {
    const session = start();

    askAtRoom(session);

    expect(session.social.sendRequestEntry).toHaveBeenCalledWith("room_1");
    expect(session.lastToast()).toMatchObject({
      look: "asking",
      title: "Asking to enter Room 1",
      description: "Waiting to be let in",
      timeout: 0,
      actions: [{ label: "Withdraw", variant: "outline" }],
    });
  });

  it("steps the member in when they are let in", () => {
    const session = start();
    askAtRoom(session);
    echo(session);

    end(session, "admitted");

    expect(session.stepInto).toHaveBeenCalledWith("room_1");
    expect(session.lastToast()).toMatchObject({
      look: "admitted",
      title: "You're in Room 1",
      description: "Tolu let you in",
    });
    expect(session.lastToast().actions).toBeUndefined();
  });

  it("tells the member to step in when it cannot do it for them", () => {
    const session = start({ steps: false });
    askAtRoom(session);
    echo(session);

    end(session, "admitted");

    expect(session.lastToast().description).toBe(
      "Step in now, before you move away",
    );
  });

  it.each([
    [
      "declined",
      "Not let into Room 1",
      `You can ask again in ${ASK_AGAIN_AFTER_S} s`,
    ],
    ["withdrawn", "Request withdrawn", "You can ask again any time"],
    ["walked_away", "Request ended", "You walked away from Room 1"],
    [
      "nobody_inside",
      "Nobody can answer",
      "No one in Room 1 can let you in now",
    ],
    ["not_needed", "Room 1 is open now", "Walk in whenever you like"],
    ["cancelled", "Room 1 isn't taking requests", "Its entry rules changed"],
    ["unknown", "Your request to enter Room 1 ended", undefined],
  ] as const)("words a %s request as %j", (outcome, title, description) => {
    const session = start();
    askAtRoom(session);
    echo(session);

    end(session, outcome);

    expect(session.lastToast().title).toBe(title);
    expect(session.lastToast().description).toBe(description);
    expect(session.stepInto).not.toHaveBeenCalled();
  });

  it("withdraws the open request", () => {
    const session = start();
    askAtRoom(session);
    echo(session);

    session.lastToast().actions![0]!.onClick();

    expect(session.social.sendWithdrawEntryRequest).toHaveBeenCalledWith("r1");
  });

  it("withdraws a request as soon as world names it", () => {
    const session = start();
    askAtRoom(session);
    session.lastToast().actions![0]!.onClick();

    expect(session.social.sendWithdrawEntryRequest).not.toHaveBeenCalled();
    echo(session);

    expect(session.social.sendWithdrawEntryRequest).toHaveBeenCalledWith("r1");
  });

  it("asks again from a failed request", () => {
    const session = start();
    askAtRoom(session);
    session.elapse();

    session.lastToast().actions![0]!.onClick();

    expect(session.social.sendRequestEntry).toHaveBeenCalledTimes(2);
    expect(session.lastToast().look).toBe("asking");
  });

  it("gives up on a request world never took", () => {
    const session = start();
    askAtRoom(session);

    session.elapse();

    expect(ANSWER_WAIT_MS).toBeGreaterThan(0);
    expect(session.lastToast()).toMatchObject({
      look: "failed",
      title: "Couldn't ask to enter Room 1",
      description: "Try again once someone is inside",
      actions: [{ label: "Try again" }],
    });
  });

  it("says when the request could not be sent", () => {
    const session = start({ sent: false });

    askAtRoom(session);

    expect(session.lastToast()).toMatchObject({
      title: "Couldn't ask to enter Room 1",
      description: "You're not connected to the campus right now",
    });
  });

  it("ends the request when the connection drops", () => {
    const session = start();
    askAtRoom(session);
    echo(session);

    session.close();

    expect(session.lastToast()).toMatchObject({
      look: "dropped",
      title: "Request ended",
      description: "Your connection to the campus dropped",
    });
  });

  it("keeps the wait up while a request is open, however often world refuses", () => {
    const session = start();
    askAtRoom(session);
    const shown = session.show.mock.calls.length;

    session.flow.refused({ mayAsk: null, spaceKey: "room_1" });

    expect(session.show).toHaveBeenCalledTimes(shown);
  });

  describe("when the map goes", () => {
    it("closes the wait and withdraws the open request", () => {
      const session = start();
      askAtRoom(session);
      echo(session);
      const shown = session.show.mock.calls.length;

      session.flow.stop();

      expect(session.closeToast).toHaveBeenCalledExactlyOnceWith(
        ENTRY_TOAST_ID,
      );
      expect(
        session.social.sendWithdrawEntryRequest,
      ).toHaveBeenCalledExactlyOnceWith("r1");
      end(session, "withdrawn");
      expect(session.show).toHaveBeenCalledTimes(shown);
    });

    it("withdraws a request world names after the map went", () => {
      const session = start();
      askAtRoom(session);

      session.flow.stop();
      expect(session.social.sendWithdrawEntryRequest).not.toHaveBeenCalled();
      echo(session);

      expect(
        session.social.sendWithdrawEntryRequest,
      ).toHaveBeenCalledExactlyOnceWith("r1");
    });

    it("stops waiting for world to name the request", () => {
      const session = start();
      askAtRoom(session);
      session.flow.stop();

      session.elapse();
      echo(session);

      expect(session.social.sendWithdrawEntryRequest).not.toHaveBeenCalled();
    });

    it("withdraws only once after the member already did", () => {
      const session = start();
      askAtRoom(session);
      echo(session);
      session.lastToast().actions![0]!.onClick();

      session.flow.stop();

      expect(session.social.sendWithdrawEntryRequest).toHaveBeenCalledOnce();
    });

    it("closes an offer to ask", () => {
      const session = start();
      session.flow.refused({ mayAsk: null, spaceKey: "room_1" });

      session.flow.stop();

      expect(session.closeToast).toHaveBeenCalledExactlyOnceWith(
        ENTRY_TOAST_ID,
      );
    });

    it("leaves a toast that times out on its own", () => {
      const session = start();
      askAtRoom(session);
      echo(session);
      end(session, "declined");

      session.flow.stop();

      expect(session.closeToast).not.toHaveBeenCalled();
    });
  });
});
