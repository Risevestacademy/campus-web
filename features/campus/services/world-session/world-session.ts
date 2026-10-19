import type { Logger } from "@/core/observability";
import type { PresenceStore } from "@/core/presence";
import {
  createRealtimeClient,
  isManuallyRecoverable,
  type RealtimeEvent,
  type RealtimeOutcome,
  type RealtimeStatus,
} from "@/core/realtime";
import type { RefreshSession } from "@/core/session";

import { type AnalyticsCapture, realtimeAnalytics } from "./realtime-analytics";

export interface WorldSessionOptions {
  url: string;
  cohortId: string;
  presence: PresenceStore;
  refreshSession: RefreshSession;
  captureEvent: (capture: AnalyticsCapture) => void;
  onOutcome: (outcome: RealtimeOutcome) => void | Promise<void>;
  createSocket: (url: string) => WebSocket;
  logger: Logger;
  random?: () => number;
  isOnline?: () => boolean;
  subscribeToWake?: (listener: () => void) => () => void;
}

export interface WorldSession {
  // Starts from idle only: a page mounting never undoes a stop.
  connect(): void;
  // The member's own press: also starts again after a stop, with a fresh budget.
  reconnect(): void;
  close(): void;
  getStatus(): RealtimeStatus;
  subscribe(listener: () => void): () => void;
}

// One cohort's place on the map: world's socket feeding who is here.
export function createWorldSession({
  cohortId,
  presence,
  captureEvent,
  onOutcome,
  ...clientOptions
}: WorldSessionOptions): WorldSession {
  function onEvent(event: RealtimeEvent) {
    for (const capture of realtimeAnalytics(event, cohortId)) {
      captureEvent(capture);
    }
    if (event.type === "message") presence.getState().apply(event.message);
    if (event.type === "closed") presence.getState().clearRemoteParticipants();
    if (event.type === "stopped") {
      if (!isManuallyRecoverable(event.outcome)) {
        presence.getState().clear();
      }
      void onOutcome(event.outcome);
    }
  }

  const client = createRealtimeClient({ ...clientOptions, onEvent });

  return {
    connect() {
      if (client.getStatus().phase === "idle") client.connect();
    },
    reconnect: client.connect,
    close() {
      client.close();
      presence.getState().clear();
    },
    getStatus: client.getStatus,
    subscribe: client.subscribe,
  };
}
