// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createPresenceStore } from "@/core/presence";
import {
  admit,
  closeWith,
  SNAPSHOT,
  startMockWorld,
  WORLD_SOCKET_URL,
} from "@/tests/fixtures/mock-world";

import { createWorldSession, type WorldSessionOptions } from "./world-session";

const { closeAfterTest, serveWorld } = startMockWorld();

function startSession(overrides: Partial<WorldSessionOptions> = {}) {
  const presence = createPresenceStore();
  const captureEvent = vi.fn<WorldSessionOptions["captureEvent"]>();
  const onOutcome = vi.fn<WorldSessionOptions["onOutcome"]>();
  const session = closeAfterTest(
    createWorldSession({
      url: WORLD_SOCKET_URL,
      cohortId: "cohort-1",
      presence,
      refreshSession: async () => true,
      captureEvent,
      onOutcome,
      createSocket: (url) => new WebSocket(url),
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
      random: () => 0,
      ...overrides,
    }),
  );

  return { captureEvent, onOutcome, presence, session };
}

describe("createWorldSession", () => {
  it("draws everyone the snapshot names and reports the connect", async () => {
    serveWorld(admit);
    const { captureEvent, presence, session } = startSession();

    session.connect();

    await vi.waitFor(() =>
      expect(session.getStatus()).toEqual({ phase: "connected" }),
    );
    expect([...presence.getState().participants.keys()]).toEqual(
      SNAPSHOT.players.map(({ userId }) => userId),
    );
    expect(captureEvent).toHaveBeenCalledExactlyOnceWith([
      "realtime.connected",
      { cohort_id: "cohort-1", reconnect: false },
    ]);
  });

  it("hands a terminal close to its caller once and empties the map", async () => {
    serveWorld(closeWith(1008, "not_a_member"));
    const { onOutcome, presence, session } = startSession();

    session.connect();

    await vi.waitFor(() =>
      expect(onOutcome).toHaveBeenCalledExactlyOnceWith("choose-cohort"),
    );
    expect(presence.getState().participants.size).toBe(0);
  });

  it("empties the map when the Presence Session closes it", async () => {
    serveWorld(admit);
    const { onOutcome, presence, session } = startSession();
    session.connect();
    await vi.waitFor(() =>
      expect(session.getStatus()).toEqual({ phase: "connected" }),
    );

    session.close();

    expect(session.getStatus()).toEqual({ phase: "idle" });
    expect(presence.getState().participants.size).toBe(0);
    expect(onOutcome).not.toHaveBeenCalled();
  });

  describe("after world closed it for good", () => {
    async function enteredElsewhere() {
      const world = serveWorld(closeWith(4000, "entered_elsewhere"));
      const started = startSession();
      started.session.connect();
      await vi.waitFor(() =>
        expect(started.onOutcome).toHaveBeenCalledWith("entered-elsewhere"),
      );
      return { ...started, world };
    }

    it("opens nothing when a page connects it again", async () => {
      const { session, world } = await enteredElsewhere();

      session.connect();

      expect(session.getStatus()).toEqual({
        phase: "closed",
        outcome: "entered-elsewhere",
      });
      expect(world.connections).toHaveLength(1);
    });

    it("opens one socket when the member asks for it", async () => {
      const { session, world } = await enteredElsewhere();

      session.reconnect();

      await vi.waitFor(() => expect(world.connections).toHaveLength(2));
    });
  });
});
