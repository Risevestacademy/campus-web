import type { Logger } from "@/core/observability";
import type { RefreshSession, SessionRefreshResult } from "@/core/session";

import { WORLD_CLOSE } from "./close-codes";
import {
  classifyClose,
  type CloseAction,
  reconnectDelay,
} from "./close-policy";
import type { ClientMessage } from "./generated/world-protocol";
import type { ServerMessage } from "./server-message.schema";
import { openWorldConnection, type WorldConnection } from "./world-connection";

export type RealtimeOutcome =
  Exclude<CloseAction, "reconnect" | "reconnect-after-refresh"> | "gave-up";

// The session stays on the map and only the member's Reconnect resumes it.
export function isManuallyRecoverable(outcome: RealtimeOutcome): boolean {
  return outcome === "gave-up" || outcome === "stop";
}

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
  refreshSession: RefreshSession;
  isOnline?: () => boolean;
  subscribeToWake?: (listener: () => void) => () => void;
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

type RecoveryKind = "connect" | "refresh";

type RecoveryState =
  | { phase: "none" }
  | { phase: "waiting"; kind: RecoveryKind }
  | { phase: "refreshing" }
  | { phase: "gave-up"; kind: RecoveryKind };

export function createRealtimeClient(
  options: RealtimeClientOptions,
): RealtimeClient {
  const random = options.random ?? Math.random;
  const listeners = new Set<() => void>();
  let status: RealtimeStatus = { phase: "idle" };
  let attempts = 0;
  let connection: WorldConnection | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  // Bumped by close() and replacement, so a close reported while a caller
  // closes from inside onEvent does not start recovery afterwards.
  let lifecycleGeneration = 0;
  let recovery: RecoveryState = { phase: "none" };
  let stopWakeSubscription: (() => void) | undefined;

  function setStatus(next: RealtimeStatus) {
    status = next;
    for (const listener of listeners) listener();
  }

  function connect() {
    ensureWakeSubscription();
    if (status.phase === "closed") {
      // A press after a stop is itself a reconnect, and starts a fresh budget.
      clearRecovery();
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
        onMessage(message) {
          options.onEvent({ type: "message", message });
          if (message.type === "replaced") stopFromReplacement();
        },
        onConnected() {
          setStatus({ phase: "connected" });
          options.onEvent({ type: "connected", attempt });
        },
        onStable() {
          attempts = 0;
        },
        onClosed(close) {
          connection = undefined;
          // Replacement already stopped the session: its close frame is a
          // formality, whether it arrives as 4000 or as a lost 1006.
          if (
            status.phase === "closed" &&
            status.outcome === "entered-elsewhere"
          ) {
            return;
          }
          const closing = lifecycleGeneration;
          const action = classifyClose(close);
          options.onEvent({
            type: "closed",
            code: close.code,
            reason: close.reason,
            action,
          });
          if (closing === lifecycleGeneration) follow(action);
        },
      },
    );
  }

  function follow(action: CloseAction) {
    if (action === "reconnect") {
      planRecovery("connect", reconnectDelay(attempts + 1, random()));
    } else if (action === "reconnect-after-refresh") {
      planRecovery("refresh", 0);
    } else {
      clearRecovery();
      stop(action);
    }
  }

  function stopFromReplacement() {
    if (status.phase === "closed" && status.outcome === "entered-elsewhere") {
      return;
    }
    lifecycleGeneration += 1;
    clearRecovery();
    connection?.end();
    connection = undefined;
    options.onEvent({
      type: "closed",
      ...WORLD_CLOSE.enteredElsewhere,
      action: "entered-elsewhere",
    });
    stop("entered-elsewhere");
  }

  // Every transition assigns a new recovery object, so identity tells whether
  // close or replacement superseded this refresh.
  async function refreshThenRetry(refreshing: RecoveryState) {
    const result = await refreshSession();
    if (recovery !== refreshing) return;
    if (result.kind === "refreshed") {
      waitWithinAttempt("connect", reconnectDelay(attempts, random()));
    } else if (result.kind === "expired") {
      clearRecovery();
      stop("sign-in");
    } else {
      planRecovery(
        "refresh",
        Math.max(
          result.retryAfterMs ?? 0,
          reconnectDelay(attempts + 1, random()),
        ),
      );
    }
  }

  async function refreshSession(): Promise<SessionRefreshResult> {
    try {
      return await options.refreshSession();
    } catch {
      return { kind: "failed" };
    }
  }

  function stop(outcome: RealtimeOutcome) {
    setStatus({ phase: "closed", outcome });
    options.onEvent({ type: "stopped", outcome, attempts });
  }

  function planRecovery(kind: RecoveryKind, delayMs: number) {
    clearTimeout(retryTimer);
    if (attempts >= MAX_CONSECUTIVE_ATTEMPTS) {
      recovery = { phase: "gave-up", kind };
      stop("gave-up");
      return;
    }
    attempts += 1;
    setStatus({ phase: "reconnecting", attempt: attempts });
    waitWithinAttempt(kind, delayMs);
  }

  function waitWithinAttempt(kind: RecoveryKind, delayMs: number) {
    recovery = { phase: "waiting", kind };
    if (isOffline()) return;
    if (delayMs === 0) {
      resumeRecovery();
      return;
    }
    retryTimer = setTimeout(resumeRecovery, delayMs);
  }

  function resumeRecovery() {
    clearTimeout(retryTimer);
    retryTimer = undefined;
    if (isOffline() || recovery.phase !== "waiting") return;
    if (recovery.kind === "connect") {
      recovery = { phase: "none" };
      openSocket();
      return;
    }
    const refreshing: RecoveryState = { phase: "refreshing" };
    recovery = refreshing;
    void refreshThenRetry(refreshing);
  }

  function isOffline() {
    return options.isOnline?.() === false;
  }

  function clearRecovery() {
    clearTimeout(retryTimer);
    retryTimer = undefined;
    recovery = { phase: "none" };
  }

  function ensureWakeSubscription() {
    stopWakeSubscription ??= options.subscribeToWake?.(wake);
  }

  function wake() {
    if (isOffline()) return;
    if (status.phase === "connected") {
      connection?.wake();
    } else if (
      status.phase === "reconnecting" &&
      recovery.phase === "waiting"
    ) {
      resumeRecovery();
    } else if (
      status.phase === "closed" &&
      status.outcome === "gave-up" &&
      recovery.phase === "gave-up"
    ) {
      const { kind } = recovery;
      attempts = 0;
      planRecovery(kind, 0);
    }
  }

  function close() {
    lifecycleGeneration += 1;
    clearRecovery();
    connection?.end();
    connection = undefined;
    attempts = 0;
    stopWakeSubscription?.();
    stopWakeSubscription = undefined;
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
