// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  admit,
  closeWith,
  type MockConnection,
  settle,
  startMockWorld,
} from "@/tests/fixtures/mock-world";

const { startClient } = startMockWorld();

const TEN_MINUTES_MS = 10 * 60_000;
const MARKER = "frame-text-must-not-be-logged";
const HOSTILE_FRAMES = [
  new Uint8Array([123, 125]),
  `{"type":"note","text":"${MARKER.repeat(40_000)}"}`,
  `{"type":"__proto__","${MARKER}":1}`,
  `{"type":"constructor","${MARKER}":1}`,
  `{"type":"toString","${MARKER}":1}`,
  "null",
  "[]",
  `"${MARKER}"`,
  `{"type":7,"${MARKER}":1}`,
  `{"type":"joined","player":"${MARKER}"}`,
  `{"type":"moved","players":[{"userId":"${MARKER}","x":-1,"y":0,"facing":"up"}]}`,
  `{"type":"welcome","userId":"${MARKER}"}`,
  `{"type":"snapshot","players":"${MARKER}"}`,
];

function sendAll(
  { client }: MockConnection,
  frames: readonly (string | Uint8Array)[],
) {
  for (const frame of frames) client.send(frame);
}

describe("realtime client eval", () => {
  it("survives hostile frames after the handshake without closing or logging their text", async () => {
    vi.useFakeTimers();
    const { client, connections, logger, events } = startClient({
      world: (connection) => {
        admit(connection);
        sendAll(connection, HOSTILE_FRAMES);
      },
    });

    client.connect();
    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS);

    expect(client.getStatus()).toEqual({ phase: "connected" });
    expect(connections).toHaveLength(1);
    expect(events().filter(({ type }) => type === "message")).toHaveLength(2);
    const logRecords = [logger.error, logger.warn, logger.info].flatMap(
      ({ mock }) => mock.calls,
    );
    expect(logRecords.length).toBeGreaterThan(0);
    expect(JSON.stringify(logRecords)).not.toContain(MARKER);
  });

  it("skips frames it does not know before the handshake instead of closing", async () => {
    vi.useFakeTimers();
    const { client, connections } = startClient({
      world: (connection) => {
        sendAll(connection, HOSTILE_FRAMES.slice(0, -2));
        admit(connection);
      },
    });

    client.connect();
    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS);

    expect(client.getStatus()).toEqual({ phase: "connected" });
    expect(connections).toHaveLength(1);
  });

  it.each([
    "entered_elsewhere",
    "",
    "server shutting down",
    "rate_limited",
    "entered_elsewhere".repeat(7),
  ])("never opens another socket on its own after 4000 %j", async (reason) => {
    vi.useFakeTimers();
    const { client, connections } = startClient({
      world: closeWith(4000, reason),
    });

    client.connect();
    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS);

    expect(connections).toHaveLength(1);
    expect(client.getStatus()).toEqual({
      phase: "closed",
      outcome: "entered-elsewhere",
    });
  });

  it.each([
    [1001, "server shutting down"],
    [1008, "rate_limited"],
    [1009, ""],
    [1011, "internal_error"],
    [4999, "unknown"],
  ])(
    "against a world that closes every socket with %i %j, retries ten times, one socket at a time",
    async (code, reason) => {
      vi.useFakeTimers();
      const { client, connections, mostLiveSockets } = startClient({
        world: closeWith(code, reason),
      });

      client.connect();
      for (let press = 0; press < 50; press += 1) {
        client.connect();
        await vi.advanceTimersByTimeAsync(1_000);
      }
      await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS);

      expect(connections).toHaveLength(11);
      expect(mostLiveSockets()).toBe(1);
      expect(client.getStatus()).toEqual({
        phase: "closed",
        outcome: "gave-up",
      });
    },
  );

  it("stops refreshing a session world keeps refusing", async () => {
    vi.useFakeTimers();
    const refreshSession = vi.fn(async () => true);
    const { client, connections } = startClient({
      world: closeWith(1008, "session_ended"),
      refreshSession,
    });

    client.connect();
    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS);

    expect(refreshSession).toHaveBeenCalledTimes(10);
    expect(connections).toHaveLength(11);
    expect(client.getStatus()).toEqual({ phase: "closed", outcome: "gave-up" });
  });

  it("never waits forever on a world that admits the socket and sends nothing", async () => {
    vi.useFakeTimers();
    const { client, connections, mostLiveSockets } = startClient();

    client.connect();
    await settle();
    await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS);

    expect(connections).toHaveLength(11);
    expect(mostLiveSockets()).toBe(1);
    expect(client.getStatus()).toEqual({ phase: "closed", outcome: "gave-up" });
  });
});
