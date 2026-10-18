import type { Logger } from "@/core/observability";

import { CLIENT_CLOSE } from "./close-codes";
import type { SocketClose } from "./close-policy";
import type { ClientMessage, ServerMessage } from "./generated/world-protocol";
import {
  parseServerMessage,
  type ServerMessageResult,
} from "./server-message.schema";
import { parseSocketClose } from "./socket-close.schema";

const HANDSHAKE: readonly ServerMessage["type"][] = ["welcome", "snapshot"];
const HANDSHAKE_TIMEOUT_MS = 10_000;
// Not on snapshot: a rate_limited or 1009 loop reaches snapshot every time
// and would retry at the first delay forever.
const STABLE_CONNECTION_MS = 60_000;

export interface ConnectionEvents {
  onMessage(message: ServerMessage): void;
  onConnected(): void;
  onStable(): void;
  onClosed(close: SocketClose): void;
}

export interface WorldConnection {
  send(message: ClientMessage): boolean;
  end(): void;
  wake(): void;
}

type FrameResult = ServerMessageResult | { ok: false; reason: "binary" };

function readFrame(data: unknown): FrameResult {
  return typeof data === "string"
    ? parseServerMessage(data)
    : { ok: false, reason: "binary" };
}

// Fields name the failure, never the frame: its text is untrusted input.
function logUnusableFrame(
  result: Exclude<FrameResult, { ok: true }>,
  logger: Logger,
) {
  if (result.reason === "invalid" && result.type) {
    logger.error("realtime.frame_invalid", { type: result.type });
  } else {
    logger.warn("realtime.frame_skipped", { reason: result.reason });
  }
}

// One socket's lifetime. Every listener goes with `release`, so a socket this
// side closed never reports a second close and never starts a second socket.
export function openWorldConnection(
  socket: WebSocket,
  logger: Logger,
  events: ConnectionEvents,
): WorldConnection {
  const listening = new AbortController();
  const awaited = new Set(HANDSHAKE);
  const handshakeTimer = setTimeout(timeOut, HANDSHAKE_TIMEOUT_MS);
  let stableTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeatTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeatIntervalMs: number | undefined;
  let heartbeatDeadlineMs = 0;
  let awaitingPong = false;

  function release() {
    listening.abort();
    clearTimeout(handshakeTimer);
    clearTimeout(stableTimer);
    clearTimeout(heartbeatTimer);
  }

  function end(close: SocketClose) {
    if (listening.signal.aborted) return;
    release();
    socket.close(close.code, close.reason);
  }

  function abandon(close: SocketClose) {
    end(close);
    events.onClosed(close);
  }

  function timeOut() {
    logger.error("realtime.handshake_timed_out", {
      awaiting: [...awaited].join(","),
    });
    abandon(CLIENT_CLOSE.handshakeTimeout);
  }

  function receive(data: unknown) {
    const result = readFrame(data);

    if (!result.ok) {
      logUnusableFrame(result, logger);
      if (
        result.reason === "invalid" &&
        result.type &&
        awaited.has(result.type)
      ) {
        abandon(CLIENT_CLOSE.invalidHandshake);
      }
      return;
    }

    if (result.message.type === "pong") awaitingPong = false;
    if (result.message.type === "welcome") {
      heartbeatIntervalMs = result.message.heartbeatSeconds * 1000;
      scheduleHeartbeat();
    }
    events.onMessage(result.message);
    if (listening.signal.aborted) return;
    if (awaited.delete(result.message.type) && awaited.size === 0) {
      clearTimeout(handshakeTimer);
      events.onConnected();
    }
  }

  function scheduleHeartbeat() {
    if (heartbeatIntervalMs === undefined) return;
    heartbeatDeadlineMs = Date.now() + heartbeatIntervalMs;
    clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(heartbeat, heartbeatIntervalMs);
  }

  function heartbeat() {
    if (awaitingPong) {
      logger.warn("realtime.heartbeat_timed_out", {});
      abandon(CLIENT_CLOSE.livenessTimeout);
      return;
    }
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify({ type: "ping" }));
      awaitingPong = true;
    }
    scheduleHeartbeat();
  }

  const listenerOptions = { signal: listening.signal };
  socket.addEventListener(
    "open",
    () => {
      stableTimer = setTimeout(events.onStable, STABLE_CONNECTION_MS);
    },
    listenerOptions,
  );
  socket.addEventListener(
    "message",
    ({ data }) => receive(data),
    listenerOptions,
  );
  socket.addEventListener(
    "close",
    ({ code, reason }) => {
      release();
      events.onClosed(parseSocketClose(code, reason));
    },
    listenerOptions,
  );

  return {
    send(message) {
      if (socket.readyState !== socket.OPEN) return false;
      socket.send(JSON.stringify(message));
      return true;
    },
    end: () => end(CLIENT_CLOSE.presenceEnded),
    wake() {
      if (heartbeatIntervalMs === undefined || listening.signal.aborted) {
        return;
      }
      // An unanswered ping still inside its deadline keeps its own timer.
      if (awaitingPong && Date.now() < heartbeatDeadlineMs) return;
      clearTimeout(heartbeatTimer);
      heartbeat();
    },
  };
}
