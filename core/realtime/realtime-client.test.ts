// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import type { SessionRefreshResult } from "@/core/session";
import {
  admit,
  closeWith,
  inTurn,
  type MockConnection as Connection,
  settle,
  SNAPSHOT,
  startMockWorld,
  WELCOME,
  WORLD_SOCKET_URL as SOCKET_URL,
} from "@/tests/fixtures/mock-world";

const { startClient } = startMockWorld();

const { awayAfterSeconds: _awayAfterSeconds, ...READ_WELCOME } = WELCOME;
const READ_SNAPSHOT = {
  type: SNAPSHOT.type,
  map: SNAPSHOT.map,
  players: SNAPSHOT.players,
};

describe("createRealtimeClient", () => {
  it("is idle until connect opens one socket to the cohort's url", async () => {
    const { client, connections } = startClient();

    expect(client.getStatus()).toEqual({ phase: "idle" });

    client.connect();

    expect(client.getStatus()).toEqual({ phase: "connecting", attempt: 0 });
    await vi.waitFor(() => expect(connections).toEqual([SOCKET_URL]));
  });

  it("is connected once welcome and snapshot arrive, forwarding both in order", async () => {
    const { client, events } = startClient({ world: admit });
    const listener = vi.fn();
    client.subscribe(listener);

    client.connect();

    await vi.waitFor(() =>
      expect(client.getStatus()).toEqual({ phase: "connected" }),
    );
    expect(events()).toEqual([
      { type: "message", message: READ_WELCOME },
      { type: "message", message: READ_SNAPSHOT },
      { type: "connected", attempt: 0 },
    ]);
    expect(listener).toHaveBeenCalled();
  });

  describe("a frame it cannot use", () => {
    it.each([
      [
        "a type world added later",
        '{"type":"teleport"}',
        "warn",
        "realtime.frame_skipped",
        { reason: "unknown-type" },
      ],
      [
        "no type",
        '{"kind":"welcome"}',
        "warn",
        "realtime.frame_skipped",
        { reason: "invalid" },
      ],
      [
        "text that is not JSON",
        "not json",
        "warn",
        "realtime.frame_skipped",
        { reason: "invalid" },
      ],
      [
        "binary data",
        new Uint8Array([1, 2, 3]),
        "warn",
        "realtime.frame_skipped",
        { reason: "binary" },
      ],
      [
        "a known type that fails to parse",
        '{"type":"joined","player":{}}',
        "error",
        "realtime.frame_invalid",
        { type: "joined" },
      ],
    ] as const)(
      "is logged and skipped when it is %s",
      async (_case, frame, level, event, fields) => {
        const { client, events, logger } = startClient({
          world: (connection) => {
            connection.client.send(frame);
            admit(connection);
          },
        });

        client.connect();

        await vi.waitFor(() =>
          expect(client.getStatus()).toEqual({ phase: "connected" }),
        );
        expect(logger[level]).toHaveBeenCalledExactlyOnceWith(event, fields);
        expect(events()).toHaveLength(3);
      },
    );
  });

  describe("a close it may retry", () => {
    it("reports the close, waits out the backoff, and connects again", async () => {
      vi.useFakeTimers();
      const { client, connections, events } = startClient({
        world: inTurn(closeWith(1011, "internal_error"), admit),
      });

      client.connect();
      await settle();

      expect(client.getStatus()).toEqual({ phase: "reconnecting", attempt: 1 });
      expect(events()).toContainEqual({
        type: "closed",
        code: 1011,
        reason: "internal_error",
        action: "reconnect",
      });

      await vi.advanceTimersByTimeAsync(499);
      expect(connections).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(connections).toHaveLength(2);
      expect(client.getStatus()).toEqual({ phase: "connected" });
      expect(events().at(-1)).toEqual({ type: "connected", attempt: 1 });
    });
  });

  describe("a close it must not retry", () => {
    it("stops on replaced on its own, before any close frame", async () => {
      vi.useFakeTimers();
      const { client, connections, events } = startClient({
        world: (connection) => {
          admit(connection);
          connection.client.send(JSON.stringify({ type: "replaced" }));
        },
      });

      client.connect();
      await settle();
      await vi.advanceTimersByTimeAsync(10 * 60_000);

      expect(client.getStatus()).toEqual({
        phase: "closed",
        outcome: "entered-elsewhere",
      });
      expect(connections).toHaveLength(1);
      expect(events().filter(({ type }) => type === "stopped")).toEqual([
        { type: "stopped", outcome: "entered-elsewhere", attempts: 0 },
      ]);
    });

    it("stops on replaced even when the later close frame is a 1006", async () => {
      // msw drops frames sent in the same tick as a server close, so the
      // replacement message is scheduled with the close that world would
      // send only after the client has read it.
      vi.useFakeTimers();
      const { client, connections, events } = startClient({
        world: (connection) => {
          admit(connection);
          connection.client.send(JSON.stringify({ type: "replaced" }));
          setTimeout(() => connection.client.close(1006), 10);
        },
      });

      client.connect();
      await settle();
      await vi.advanceTimersByTimeAsync(10);
      await settle();
      await vi.advanceTimersByTimeAsync(10 * 60_000);

      expect(client.getStatus()).toEqual({
        phase: "closed",
        outcome: "entered-elsewhere",
      });
      expect(connections).toHaveLength(1);
      // The outcome was already terminal: the abrupt close after the
      // replacement produced exactly one reported close, the synthetic 4000.
      expect(events().filter(({ type }) => type === "closed")).toEqual([
        {
          type: "closed",
          code: 4000,
          reason: "entered_elsewhere",
          action: "entered-elsewhere",
        },
      ]);
      expect(events().filter(({ type }) => type === "stopped")).toEqual([
        { type: "stopped", outcome: "entered-elsewhere", attempts: 0 },
      ]);
    });

    it.each([
      [4000, "entered_elsewhere", "entered-elsewhere"],
      [1008, "no_token", "sign-in"],
      [1008, "session_revoked", "sign-in"],
      [1008, "wrong_scope", "onboarding"],
      [1008, "account_gone", "sign-out"],
      [1008, "not_a_member", "choose-cohort"],
      [1008, "origin_not_allowed", "stop"],
    ])(
      "%i %s stops with %s and never opens another socket",
      async (code, reason, outcome) => {
        vi.useFakeTimers();
        const { client, connections, events } = startClient({
          world: closeWith(code, reason),
        });

        client.connect();
        await settle();
        await vi.advanceTimersByTimeAsync(10 * 60_000);

        expect(client.getStatus()).toEqual({ phase: "closed", outcome });
        expect(connections).toHaveLength(1);
        expect(events().filter(({ type }) => type === "stopped")).toEqual([
          { type: "stopped", outcome, attempts: 0 },
        ]);
      },
    );
  });

  describe("a close that needs a fresh session", () => {
    it.each(["token_not_usable", "session_expired", "session_ended"])(
      "1008 %s refreshes once, then reconnects after the backoff",
      async (reason) => {
        vi.useFakeTimers();
        const refreshSession = vi.fn(async () => ({
          kind: "refreshed" as const,
        }));
        const { client, connections } = startClient({
          world: inTurn(closeWith(1008, reason), admit),
          refreshSession,
        });

        client.connect();
        await settle();

        expect(refreshSession).toHaveBeenCalledOnce();
        expect(client.getStatus()).toEqual({
          phase: "reconnecting",
          attempt: 1,
        });

        await vi.advanceTimersByTimeAsync(500);
        expect(connections).toHaveLength(2);
        expect(client.getStatus()).toEqual({ phase: "connected" });
      },
    );

    it("sends the member to sign in only when the refresh token expired", async () => {
      vi.useFakeTimers();
      const { client, connections, events } = startClient({
        world: closeWith(1008, "session_ended"),
        refreshSession: async () => ({ kind: "expired" }),
      });

      client.connect();
      await settle();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(client.getStatus()).toEqual({
        phase: "closed",
        outcome: "sign-in",
      });
      expect(connections).toHaveLength(1);
      expect(events().at(-1)).toEqual({
        type: "stopped",
        outcome: "sign-in",
        attempts: 1,
      });
    });

    it("retries a transient refresh failure without opening a stale socket", async () => {
      vi.useFakeTimers();
      const refreshSession = vi
        .fn()
        .mockResolvedValueOnce({ kind: "failed", retryAfterMs: 2_000 })
        .mockResolvedValueOnce({ kind: "refreshed" });
      const { client, connections } = startClient({
        world: inTurn(closeWith(1008, "session_ended"), admit),
        refreshSession,
      });

      client.connect();
      await settle();
      await vi.advanceTimersByTimeAsync(1_999);
      expect(connections).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(1);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(refreshSession).toHaveBeenCalledTimes(2);
      expect(connections).toHaveLength(2);
    });
  });

  describe("the retry cap", () => {
    it("gives up after ten failed attempts in a row", async () => {
      vi.useFakeTimers();
      const { client, connections, events } = startClient({
        world: closeWith(1011, "internal_error"),
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(10 * 60_000);

      expect(connections).toHaveLength(11);
      expect(client.getStatus()).toEqual({
        phase: "closed",
        outcome: "gave-up",
      });
      expect(events().filter(({ type }) => type === "stopped")).toEqual([
        { type: "stopped", outcome: "gave-up", attempts: 10 },
      ]);
    });

    it("counts a reconnect after a refresh, so a refusal world repeats still stops", async () => {
      vi.useFakeTimers();
      const refreshSession = vi.fn(async () => ({
        kind: "refreshed" as const,
      }));
      const { client, connections } = startClient({
        world: closeWith(1008, "session_ended"),
        refreshSession,
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(10 * 60_000);

      expect(refreshSession).toHaveBeenCalledTimes(10);
      expect(connections).toHaveLength(11);
      expect(client.getStatus()).toEqual({
        phase: "closed",
        outcome: "gave-up",
      });
    });
  });

  describe("the attempt count", () => {
    it.each([
      [60_000, 1],
      [59_999, 2],
    ])(
      "after a socket stays open %i ms, the next drop is attempt %i",
      async (openForMs, attempt) => {
        vi.useFakeTimers();
        let held: Connection | undefined;
        const { client } = startClient({
          world: inTurn(closeWith(1011, "internal_error"), (connection) => {
            admit(connection);
            held = connection;
          }),
        });

        client.connect();
        await settle();
        await vi.advanceTimersByTimeAsync(500);
        expect(client.getStatus()).toEqual({ phase: "connected" });

        await vi.advanceTimersByTimeAsync(openForMs);
        held?.client.close(1011, "internal_error");
        await settle();

        expect(client.getStatus()).toEqual({ phase: "reconnecting", attempt });
      },
    );
  });

  describe("a silent connection", () => {
    it("closes with 4003 and reconnects when no pong answers a ping", async () => {
      vi.useFakeTimers();
      const { client, connections, events, logger } = startClient({
        world: admit,
        autoPong: false,
      });

      client.connect();
      await settle();
      await vi.advanceTimersByTimeAsync(61_000);

      expect(logger.warn).toHaveBeenCalledWith(
        "realtime.heartbeat_timed_out",
        {},
      );
      expect(events()).toContainEqual({
        type: "closed",
        code: 4003,
        reason: "liveness_timeout",
        action: "reconnect",
      });
      expect(connections).toHaveLength(2);
    });
  });

  describe("wake recovery", () => {
    let wakeListener: () => void = () => {};

    function wake() {
      wakeListener();
    }

    function started(
      overrides: Partial<Parameters<typeof startClient>[0]> = {},
    ) {
      return startClient({
        subscribeToWake(listener) {
          wakeListener = listener;
          return () => {
            wakeListener = () => {};
          };
        },
        ...overrides,
      });
    }

    it("probes a connected socket without replacing a healthy one", async () => {
      vi.useFakeTimers();
      const { client, connections, mostLiveSockets } = started({
        world: admit,
      });

      client.connect();
      await settle();
      wake();
      await settle();

      expect(connections).toHaveLength(1);
      expect(mostLiveSockets()).toBe(1);
      expect(client.getStatus()).toEqual({ phase: "connected" });
    });

    it("reconnects through the normal budget when a wake probe finds a stale socket", async () => {
      vi.useFakeTimers();
      const { client, connections, mostLiveSockets } = started({
        world: admit,
        autoPong: false,
      });

      client.connect();
      await settle();
      const heartbeatDeadline = Date.now() + 30_000;
      wake();
      vi.setSystemTime(heartbeatDeadline);
      wake();
      await settle();

      expect(client.getStatus()).toEqual({ phase: "reconnecting", attempt: 1 });
      await vi.advanceTimersByTimeAsync(500);

      expect(connections).toHaveLength(2);
      expect(mostLiveSockets()).toBe(1);
    });

    it("reconnects immediately instead of waiting out the backoff", async () => {
      vi.useFakeTimers();
      const { client, connections } = started({
        world: inTurn(closeWith(1011, "internal_error")),
      });

      client.connect();
      await settle();
      expect(client.getStatus()).toEqual({ phase: "reconnecting", attempt: 1 });

      wake();
      await settle();

      expect(connections).toHaveLength(2);
      expect(client.getStatus()).toEqual({ phase: "connecting", attempt: 1 });
    });

    it("does not bypass a session refresh already in flight", async () => {
      vi.useFakeTimers();
      let finishRefresh: (result: SessionRefreshResult) => void = () => {};
      const refreshSession = vi.fn(
        () =>
          new Promise<SessionRefreshResult>((resolve) => {
            finishRefresh = resolve;
          }),
      );
      const { client, connections } = started({
        world: inTurn(closeWith(1008, "session_ended"), admit),
        refreshSession,
      });

      client.connect();
      await settle();
      wake();

      expect(refreshSession).toHaveBeenCalledOnce();
      expect(connections).toHaveLength(1);

      finishRefresh({ kind: "refreshed" });
      await settle();
      await vi.advanceTimersByTimeAsync(500);

      expect(connections).toHaveLength(2);
    });

    it("resumes the pending refresh rather than opening a stale socket", async () => {
      vi.useFakeTimers();
      const refreshSession = vi
        .fn()
        .mockResolvedValueOnce({ kind: "failed", retryAfterMs: 2_000 })
        .mockResolvedValueOnce({ kind: "refreshed" });
      const { client, connections } = started({
        world: inTurn(closeWith(1008, "session_ended"), admit),
        refreshSession,
      });

      client.connect();
      await settle();
      wake();
      await settle();

      expect(refreshSession).toHaveBeenCalledTimes(2);
      expect(connections).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(connections).toHaveLength(2);
    });

    it("leaves a terminal refusal stopped", async () => {
      vi.useFakeTimers();
      const { client, connections } = started({
        world: closeWith(1008, "not_a_member"),
      });

      client.connect();
      await settle();
      wake();

      expect(client.getStatus()).toEqual({
        phase: "closed",
        outcome: "choose-cohort",
      });
      expect(connections).toHaveLength(1);
    });

    it("brings a gave-up session back on its feet", async () => {
      vi.useFakeTimers();
      const { client, connections } = started({
        world: closeWith(1011, "internal_error"),
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(10 * 60_000);
      expect(client.getStatus()).toEqual({
        phase: "closed",
        outcome: "gave-up",
      });

      wake();
      await settle();

      expect(client.getStatus().phase).not.toBe("closed");
      expect(connections).toHaveLength(12);
    });

    it("retries refresh first when refresh failures exhausted the budget", async () => {
      vi.useFakeTimers();
      const refreshSession = vi.fn(async () => ({ kind: "failed" as const }));
      const { client, connections } = started({
        world: closeWith(1008, "session_ended"),
        refreshSession,
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(10 * 60_000);
      expect(client.getStatus()).toEqual({
        phase: "closed",
        outcome: "gave-up",
      });
      expect(refreshSession).toHaveBeenCalledTimes(10);

      wake();
      await settle();

      expect(refreshSession).toHaveBeenCalledTimes(11);
      expect(connections).toHaveLength(1);
    });
  });

  describe("an offline connection attempt", () => {
    it("pauses the retry budget instead of burning it, and resumes on wake", async () => {
      vi.useFakeTimers();
      let online = false;
      let wakeListener: () => void = () => {};
      const { client, connections } = startClient({
        world: inTurn(closeWith(1011, "internal_error"), () => {}),
        isOnline: () => online,
        subscribeToWake(listener) {
          wakeListener = listener;
          return () => {
            wakeListener = () => {};
          };
        },
      });

      client.connect();
      await settle();
      await vi.advanceTimersByTimeAsync(10 * 60_000);

      expect(client.getStatus()).toEqual({
        phase: "reconnecting",
        attempt: 1,
      });
      expect(connections).toHaveLength(1);

      online = true;
      wakeListener();
      await settle();

      expect(client.getStatus().phase).toBe("connecting");
      expect(connections).toHaveLength(2);
    });

    it("resumes a failed refresh with another refresh before reconnecting", async () => {
      vi.useFakeTimers();
      let online = true;
      let wakeListener: () => void = () => {};
      let finishRefresh: (result: SessionRefreshResult) => void = () => {};
      const refreshSession = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<SessionRefreshResult>((resolve) => {
              finishRefresh = resolve;
            }),
        )
        .mockResolvedValueOnce({ kind: "refreshed" });
      const { client, connections } = startClient({
        world: inTurn(closeWith(1008, "session_ended"), admit),
        refreshSession,
        isOnline: () => online,
        subscribeToWake(listener) {
          wakeListener = listener;
          return () => {
            wakeListener = () => {};
          };
        },
      });

      client.connect();
      await settle();
      online = false;
      finishRefresh({ kind: "failed" });
      await settle();
      await vi.advanceTimersByTimeAsync(10 * 60_000);

      expect(refreshSession).toHaveBeenCalledOnce();
      expect(connections).toHaveLength(1);

      online = true;
      wakeListener();
      await settle();
      expect(refreshSession).toHaveBeenCalledTimes(2);
      expect(connections).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(connections).toHaveLength(2);
    });
  });

  describe("a handshake that cannot finish", () => {
    function recordClose(connection: Connection, closes: [number, string][]) {
      connection.client.addEventListener("close", ({ code, reason }) => {
        closes.push([code, reason]);
      });
    }

    it.each([
      [
        "welcome",
        (connection: Connection) => {
          connection.client.send('{"type":"welcome","userId":7}');
        },
      ],
      [
        "snapshot",
        (connection: Connection) => {
          connection.client.send(JSON.stringify(WELCOME));
          connection.client.send('{"type":"snapshot","players":"everyone"}');
        },
      ],
    ])(
      "closes with 4001 on an invalid %s and reconnects with backoff",
      async (type, send) => {
        vi.useFakeTimers();
        const closes: [number, string][] = [];
        const { client, connections, events, logger } = startClient({
          world: inTurn((connection) => {
            recordClose(connection, closes);
            send(connection);
          }, admit),
        });

        client.connect();
        await settle();

        expect(logger.error).toHaveBeenCalledWith("realtime.frame_invalid", {
          type,
        });
        expect(closes).toEqual([[4001, "invalid_handshake"]]);
        expect(events()).toContainEqual({
          type: "closed",
          code: 4001,
          reason: "invalid_handshake",
          action: "reconnect",
        });
        expect(client.getStatus()).toEqual({
          phase: "reconnecting",
          attempt: 1,
        });

        await vi.advanceTimersByTimeAsync(500);
        expect(connections).toHaveLength(2);
        expect(client.getStatus()).toEqual({ phase: "connected" });
      },
    );

    it("closes with 4002 when the snapshot has not arrived 10 s after connecting", async () => {
      vi.useFakeTimers();
      const closes: [number, string][] = [];
      const { client, events, logger } = startClient({
        world: (connection) => {
          recordClose(connection, closes);
          connection.client.send(JSON.stringify(WELCOME));
        },
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(9_999);
      expect(client.getStatus()).toEqual({ phase: "connecting", attempt: 0 });

      await vi.advanceTimersByTimeAsync(1);

      expect(closes).toEqual([[4002, "handshake_timeout"]]);
      expect(logger.error).toHaveBeenCalledWith(
        "realtime.handshake_timed_out",
        {
          awaiting: "snapshot",
        },
      );
      expect(events().filter(({ type }) => type === "closed")).toEqual([
        {
          type: "closed",
          code: 4002,
          reason: "handshake_timeout",
          action: "reconnect",
        },
      ]);
      expect(client.getStatus()).toEqual({ phase: "reconnecting", attempt: 1 });
    });

    it("only logs an invalid welcome that follows the handshake", async () => {
      vi.useFakeTimers();
      const { client, connections } = startClient({
        world: (connection) => {
          admit(connection);
          connection.client.send('{"type":"welcome","userId":7}');
        },
      });

      client.connect();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(client.getStatus()).toEqual({ phase: "connected" });
      expect(connections).toHaveLength(1);
    });
  });

  describe("send", () => {
    it("writes the message as one JSON frame while the socket is open", async () => {
      const received: unknown[] = [];
      const { client } = startClient({
        world: (connection) => {
          connection.client.addEventListener("message", ({ data }) => {
            received.push(data);
          });
          admit(connection);
        },
      });

      client.connect();
      await vi.waitFor(() =>
        expect(client.getStatus()).toEqual({ phase: "connected" }),
      );

      expect(client.send({ type: "move", direction: "up", seq: 1 })).toBe(true);
      await vi.waitFor(() =>
        expect(received).toEqual(['{"type":"move","direction":"up","seq":1}']),
      );
    });

    it("drops the message, and says so, while no socket is open", async () => {
      vi.useFakeTimers();
      const { client } = startClient({
        world: closeWith(1011, "internal_error"),
      });

      expect(client.send({ type: "ping" })).toBe(false);

      client.connect();
      expect(client.send({ type: "ping" })).toBe(false);

      await settle();
      expect(client.getStatus()).toEqual({ phase: "reconnecting", attempt: 1 });
      expect(client.send({ type: "ping" })).toBe(false);
    });
  });

  describe("close", () => {
    it("ends the socket with 1000 and goes idle without reporting a drop", async () => {
      vi.useFakeTimers();
      const closes: number[] = [];
      const { client, connections, events } = startClient({
        world: (connection) => {
          connection.client.addEventListener("close", ({ code }) => {
            closes.push(code);
          });
          admit(connection);
        },
      });

      client.connect();
      await settle();
      const eventsBeforeClose = events().length;

      client.close();
      await vi.advanceTimersByTimeAsync(10 * 60_000);

      expect(client.getStatus()).toEqual({ phase: "idle" });
      expect(closes).toEqual([1000]);
      expect(connections).toHaveLength(1);
      expect(events()).toHaveLength(eventsBeforeClose);
    });

    it("cancels a scheduled reconnect", async () => {
      vi.useFakeTimers();
      const { client, connections } = startClient({
        world: closeWith(1011, "internal_error"),
      });

      client.connect();
      await settle();
      client.close();
      await vi.advanceTimersByTimeAsync(10 * 60_000);

      expect(client.getStatus()).toEqual({ phase: "idle" });
      expect(connections).toHaveLength(1);
    });

    it("ignores a refresh that finishes after it", async () => {
      vi.useFakeTimers();
      const refresh = Promise.withResolvers<SessionRefreshResult>();
      const { client, connections } = startClient({
        world: closeWith(1008, "session_ended"),
        refreshSession: () => refresh.promise,
      });

      client.connect();
      await settle();
      client.close();
      refresh.resolve({ kind: "refreshed" });
      await vi.advanceTimersByTimeAsync(10 * 60_000);

      expect(client.getStatus()).toEqual({ phase: "idle" });
      expect(connections).toHaveLength(1);
    });

    it("starts a fresh session on the next connect", async () => {
      vi.useFakeTimers();
      const { client, events } = startClient({
        world: inTurn(closeWith(1011, "internal_error"), admit),
      });

      client.connect();
      await settle();
      client.close();
      client.connect();
      await settle();

      expect(events().at(-1)).toEqual({ type: "connected", attempt: 0 });
    });
  });

  describe("connect", () => {
    it("never opens a second socket while one is live or a retry is scheduled", async () => {
      vi.useFakeTimers();
      const { client, connections } = startClient({
        world: inTurn(closeWith(1011, "internal_error"), admit),
      });

      client.connect();
      client.connect();
      await settle();
      expect(client.getStatus()).toEqual({ phase: "reconnecting", attempt: 1 });
      client.connect();

      await vi.advanceTimersByTimeAsync(500);
      client.connect();
      await settle();

      expect(client.getStatus()).toEqual({ phase: "connected" });
      expect(connections).toHaveLength(2);
    });

    it("after giving up, connects at once with a fresh budget of ten attempts", async () => {
      vi.useFakeTimers();
      const { client, connections, events } = startClient({
        world: closeWith(1011, "internal_error"),
      });
      client.connect();
      await vi.advanceTimersByTimeAsync(10 * 60_000);
      expect(connections).toHaveLength(11);

      client.connect();
      expect(client.getStatus()).toEqual({ phase: "connecting", attempt: 1 });
      await vi.advanceTimersByTimeAsync(10 * 60_000);

      expect(connections).toHaveLength(21);
      expect(events().filter(({ type }) => type === "stopped")).toEqual([
        { type: "stopped", outcome: "gave-up", attempts: 10 },
        { type: "stopped", outcome: "gave-up", attempts: 10 },
      ]);
    });

    it("after entered_elsewhere, reports the connect as a reconnect", async () => {
      vi.useFakeTimers();
      const { client, events } = startClient({
        world: inTurn(closeWith(4000, "entered_elsewhere"), admit),
      });

      client.connect();
      await settle();
      client.connect();
      await settle();

      expect(events().at(-1)).toEqual({ type: "connected", attempt: 1 });
    });
  });

  it("tells a caller that closes from inside onEvent nothing more", async () => {
    const { client, events } = startClient({
      world: admit,
      onEvent: (event, self) => {
        if (event.type === "message" && event.message.type === "snapshot") {
          self.close();
        }
      },
    });

    client.connect();
    await vi.waitFor(() =>
      expect(events().map(({ type }) => type)).toEqual(["message", "message"]),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(client.getStatus()).toEqual({ phase: "idle" });
    expect(events()).toHaveLength(2);
  });

  it("never retries for a caller that closes from inside the closed event", async () => {
    vi.useFakeTimers();
    const { client, connections } = startClient({
      world: closeWith(1011, "internal_error"),
      onEvent: (event, self) => {
        if (event.type === "closed") self.close();
      },
    });

    client.connect();
    await vi.advanceTimersByTimeAsync(10 * 60_000);

    expect(client.getStatus()).toEqual({ phase: "idle" });
    expect(connections).toHaveLength(1);
  });
});
