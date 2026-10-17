import { type WebSocketHandlerConnection, ws } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

import {
  createRealtimeClient,
  type RealtimeClient,
  type RealtimeEvent,
} from "@/core/realtime";

import { serverFrames } from "./world-frames";

export const WORLD_SOCKET_URL =
  "wss://ws.example.test/socket?cohortId=cohort-1";

export const WELCOME = serverFrames.welcome;
export const SNAPSHOT = serverFrames.snapshot;

export type MockConnection = WebSocketHandlerConnection;
type WorldBehaviour = (connection: MockConnection) => void;

export function admit({ client }: MockConnection) {
  client.send(JSON.stringify(WELCOME));
  client.send(JSON.stringify(SNAPSHOT));
}

export function closeWith(code: number, reason: string): WorldBehaviour {
  return (connection) => {
    admit(connection);
    connection.client.close(code, reason);
  };
}

export function inTurn(...behaviours: WorldBehaviour[]): WorldBehaviour {
  let index = 0;
  return (connection) => behaviours[index++]?.(connection);
}

// msw delivers socket events in microtasks, which fake timers leave running.
export const settle = () => vi.advanceTimersByTimeAsync(0);

interface MockClientOptions {
  world?: WorldBehaviour;
  refreshSession?: () => Promise<boolean>;
  onEvent?: (event: RealtimeEvent, client: RealtimeClient) => void;
}

// Registers its own lifecycle hooks: call once, at the top of a test file.
export function startMockWorld() {
  const link = ws.link(new URL("/socket", WORLD_SOCKET_URL).href);
  const server = setupServer();
  const closeables: { close(): void }[] = [];

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    for (const closeable of closeables.splice(0)) closeable.close();
    server.resetHandlers();
    vi.useRealTimers();
  });
  afterAll(() => server.close());

  // Answers every socket with world; the counts are what reached it.
  function serveWorld(world: WorldBehaviour = () => {}) {
    const connections: string[] = [];
    let live = 0;
    let mostLive = 0;
    server.use(
      link.addEventListener("connection", (connection) => {
        connections.push(connection.client.url.href);
        live += 1;
        mostLive = Math.max(mostLive, live);
        connection.client.addEventListener("close", () => {
          live -= 1;
        });
        world(connection);
      }),
    );

    return { connections, mostLiveSockets: () => mostLive };
  }

  // Closed after each test, so no socket or retry outlives it.
  function closeAfterTest<Closeable extends { close(): void }>(
    closeable: Closeable,
  ): Closeable {
    closeables.push(closeable);
    return closeable;
  }

  function startClient({
    world,
    refreshSession = async () => true,
    onEvent = () => {},
  }: MockClientOptions = {}) {
    const { connections, mostLiveSockets } = serveWorld(world);
    const events: RealtimeEvent[] = [];
    const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    const client = closeAfterTest(
      createRealtimeClient({
        url: WORLD_SOCKET_URL,
        createSocket: (url) => new WebSocket(url),
        logger,
        onEvent(event) {
          events.push(event);
          onEvent(event, client);
        },
        refreshSession,
        random: () => 0,
      }),
    );

    return {
      client,
      connections,
      logger,
      events: () => events,
      mostLiveSockets,
    };
  }

  return { closeAfterTest, serveWorld, startClient };
}
