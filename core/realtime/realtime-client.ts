import type { Logger } from "@/core/observability";

import {
  classifyClose,
  type CloseAction,
  reconnectDelay,
} from "./close-policy";
import type { ClientMessage, ServerMessage } from "./generated/world-protocol";
import { openWorldConnection, type WorldConnection } from "./world-connection";

export type RealtimeOutcome =
  Exclude<CloseAction, "reconnect" | "reconnect-after-refresh"> | "gave-up";

export type RealtimeStatus =
  | { phase: "idle" }
  | { phase: "connecting"; attempt: number }
  | { phase: "connected" }
  | { phase: "reconnecting"; attempt: number }
  | { phase: "closed"; outcome: RealtimeOutcome };

export type RealtimeEvent =
  | { type: "message"; message: ServerMessage }
  | { type: "connected"; attempt: number }
  | { type: "closed"; code: number; reason: string; action: CloseAction }
  | { type: "stopped"; outcome: RealtimeOutcome; attempts: number };

export interface RealtimeClientOptions {
  url: string;
  createSocket: (url: string) => WebSocket;
  logger: Logger;
  onEvent: (event: RealtimeEvent) => void;
  refreshSession: () => Promise<boolean>;
  random?: () => number;
}

export interface RealtimeClient {
  connect(): void;
  send(message: ClientMessage): boolean;
  close(): void;
  getStatus(): RealtimeStatus;
  subscribe(listener: () => void): () => void;
}

const MAX_CONSECUTIVE_ATTEMPTS = 10;

export function createRealtimeClient(
  options: RealtimeClientOptions,
): RealtimeClient {
  const random = options.random ?? Math.random;
  const listeners = new Set<() => void>();
  let status: RealtimeStatus = { phase: "idle" };
  let attempts = 0;
  let connection: WorldConnection | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  // Bumped by close(), so work it interrupted (a refresh in flight, a caller
  // closing from inside onEvent) does not carry on afterwards.
  let session = 0;

  function setStatus(next: RealtimeStatus) {
    status = next;
    for (const listener of listeners) listener();
  }

  function connect() {
    if (status.phase === "closed") {
      // A press after a stop is itself a reconnect, and starts a fresh budget.
      attempts = 1;
    } else if (status.phase !== "idle") {
      return;
    }
    openSocket();
  }

  function openSocket() {
    const attempt = attempts;
    setStatus({ phase: "connecting", attempt });

    connection = openWorldConnection(
      options.createSocket(options.url),
      options.logger,
      {
        onMessage: (message) => options.onEvent({ type: "message", message }),
        onConnected() {
          setStatus({ phase: "connected" });
          options.onEvent({ type: "connected", attempt });
        },
        onStable() {
          attempts = 0;
        },
        onClosed({ code, reason }) {
          connection = undefined;
          const closing = session;
          const action = classifyClose({ code, reason });
          options.onEvent({ type: "closed", code, reason, action });
          if (closing === session) follow(action);
        },
      },
    );
  }

  function follow(action: CloseAction) {
    if (action === "reconnect") {
      retry();
    } else if (action === "reconnect-after-refresh") {
      void refreshThenRetry();
    } else {
      stop(action);
    }
  }

  async function refreshThenRetry() {
    if (!countAttempt()) return;
    const refreshing = session;
    const refreshed = await refreshSucceeds();
    if (refreshing !== session) return;
    if (refreshed) {
      scheduleReconnect();
    } else {
      stop("sign-in");
    }
  }

  async function refreshSucceeds(): Promise<boolean> {
    try {
      return await options.refreshSession();
    } catch {
      return false;
    }
  }

  function stop(outcome: RealtimeOutcome) {
    setStatus({ phase: "closed", outcome });
    options.onEvent({ type: "stopped", outcome, attempts });
  }

  function retry() {
    if (countAttempt()) scheduleReconnect();
  }

  function countAttempt(): boolean {
    if (attempts >= MAX_CONSECUTIVE_ATTEMPTS) {
      stop("gave-up");
      return false;
    }
    attempts += 1;
    setStatus({ phase: "reconnecting", attempt: attempts });
    return true;
  }

  function scheduleReconnect() {
    retryTimer = setTimeout(openSocket, reconnectDelay(attempts, random()));
  }

  function close() {
    session += 1;
    clearTimeout(retryTimer);
    connection?.end();
    connection = undefined;
    attempts = 0;
    setStatus({ phase: "idle" });
  }

  return {
    connect,
    send: (message) => connection?.send(message) ?? false,
    close,
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
