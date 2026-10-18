// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createPresenceStore } from "@/core/presence";
import { createWorldMovementChannel } from "@/core/realtime";
import {
  admit,
  closeWith,
  type MockConnection,
  settle,
  SNAPSHOT,
  startMockWorld,
  WELCOME,
  WORLD_SOCKET_URL,
} from "@/tests/fixtures/mock-world";

import { createWorldSession, type WorldSessionOptions } from "./world-session";

const { closeAfterTest, serveWorld } = startMockWorld();

function startSession(overrides: Partial<WorldSessionOptions> = {}) {
  const presence = createPresenceStore();
  const movement = overrides.movement ?? createWorldMovementChannel();
  const captureEvent = vi.fn<WorldSessionOptions["captureEvent"]>();
  const onOutcome = vi.fn<WorldSessionOptions["onOutcome"]>();
  const session = closeAfterTest(
    createWorldSession({
      url: WORLD_SOCKET_URL,
      cohortId: "cohort-1",
      movement,
      presence,
      refreshSession: async () => ({ kind: "refreshed" }),
      captureEvent,
      onOutcome,
      createSocket: (url) => new WebSocket(url),
      logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
      random: () => 0,
      ...overrides,
    }),
  );

  return { captureEvent, movement, onOutcome, presence, session };
}

describe("createWorldSession", () => {
  it("sends movement through the admitted socket", async () => {
    const received: unknown[] = [];
    serveWorld((connection) => {
      connection.client.addEventListener("message", ({ data }) => {
        received.push(JSON.parse(String(data)));
      });
      admit(connection);
    });
    const { movement, session } = startSession();
    session.connect();
    await vi.waitFor(() =>
      expect(session.getStatus()).toEqual({ phase: "connected" }),
    );

    expect(movement.sendMove({ direction: "right", seq: 1 })).toBe(true);

    await vi.waitFor(() =>
      expect(received).toContainEqual({
        type: "move",
        direction: "right",
        seq: 1,
      }),
    );
  });

  it("keeps movement on the active session when another constructed session is discarded", async () => {
    const received: unknown[] = [];
    serveWorld((connection) => {
      connection.client.addEventListener("message", ({ data }) => {
        received.push(JSON.parse(String(data)));
      });
      admit(connection);
    });
    const movement = createWorldMovementChannel();
    const active = startSession({ movement });
    startSession({ movement });

    active.session.connect();
    await vi.waitFor(() =>
      expect(active.session.getStatus()).toEqual({ phase: "connected" }),
    );

    expect(movement.sendMove({ direction: "right", seq: 1 })).toBe(true);
    await vi.waitFor(() =>
      expect(received).toContainEqual({
        type: "move",
        direction: "right",
        seq: 1,
      }),
    );
  });

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

  it("removes remote participants as soon as a recoverable close starts", async () => {
    vi.useFakeTimers();
    // msw delivers a server close in the same tick INSTEAD of frames sent
    // before it, so the close starts after the snapshot has been read.
    serveWorld((connection) => {
      admit(connection);
      setTimeout(() => connection.client.close(1011, "internal_error"), 10);
    });
    const { presence, session } = startSession();

    session.connect();
    await settle();
    await vi.advanceTimersByTimeAsync(10);
    await settle();

    expect(session.getStatus()).toEqual({ phase: "reconnecting", attempt: 1 });
    expect([...presence.getState().participants.keys()]).toEqual([
      presence.getState().selfId,
    ]);
  });

  it("keeps the map and local member after giving up so Reconnect stays in place", async () => {
    vi.useFakeTimers();
    serveWorld(closeWith(1011, "internal_error"));
    const { presence, session } = startSession();
    presence.getState().apply(WELCOME);
    presence.getState().apply(SNAPSHOT);

    session.connect();
    await vi.advanceTimersByTimeAsync(10 * 60_000);

    expect(session.getStatus()).toEqual({
      phase: "closed",
      outcome: "gave-up",
    });
    expect(presence.getState().map).toEqual(SNAPSHOT.map);
    expect([...presence.getState().participants.keys()]).toEqual([
      WELCOME.userId,
    ]);
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

  it("disables movement when replacement stops the socket", async () => {
    let connection: MockConnection | undefined;
    serveWorld((connected) => {
      admit(connected);
      connection = connected;
    });
    const { movement, onOutcome, session } = startSession();

    session.connect();
    await vi.waitFor(() =>
      expect(session.getStatus()).toEqual({ phase: "connected" }),
    );
    expect(movement.readStepMs()).toBe(100);

    connection?.client.send(JSON.stringify({ type: "replaced" }));
    await vi.waitFor(() =>
      expect(onOutcome).toHaveBeenCalledWith("entered-elsewhere"),
    );

    expect(movement.readStepMs()).toBeNull();
    expect(movement.sendMove({ direction: "right", seq: 1 })).toBe(false);
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
