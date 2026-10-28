import type { Logger } from "@/core/observability";
import type { Presence, PresenceStore } from "@/core/presence";
import {
  createRealtimeClient,
  isManuallyRecoverable,
  type RealtimeEvent,
  type RealtimeOutcome,
  type RealtimeStatus,
  type ServerMessage,
  type WorldMovementChannel,
} from "@/core/realtime";
import type { RefreshSession } from "@/core/session";

import { type AnalyticsCapture, realtimeAnalytics } from "./realtime-analytics";

export interface WorldSessionOptions {
  url: string;
  movement: WorldMovementChannel;
  presence: PresenceStore;
  refreshSession: RefreshSession;
  captureEvent: (capture: AnalyticsCapture) => void;
  onOutcome: (outcome: RealtimeOutcome) => void | Promise<void>;
  // Runs after presence applies the frame, so it reads the presence it produced.
  onMessage?: (message: ServerMessage, presence: Presence) => void;
  onRemoteParticipantsCleared?: (presence: Presence) => void;
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
  // A fresh socket for a live session, so World sends its call again. False
  // when the session is not connected, so nothing was refreshed.
  rejoin(): boolean;
  close(): void;
  getStatus(): RealtimeStatus;
  subscribe(listener: () => void): () => void;
}

// One cohort's place on the map: world's socket feeding who is here.
export function createWorldSession({
  movement,
  presence,
  captureEvent,
  onOutcome,
  onMessage,
  onRemoteParticipantsCleared,
  ...clientOptions
}: WorldSessionOptions): WorldSession {
  // Until the next welcome nobody can be moved or heard, so remote
  // participants go and movement waits.
  function pauseOnDisconnect() {
    movement.disconnect();
    presence.getState().clearRemoteParticipants();
    onRemoteParticipantsCleared?.(presence.getState());
  }

  function onEvent(event: RealtimeEvent) {
    for (const capture of realtimeAnalytics(event)) {
      captureEvent(capture);
    }
    if (event.type === "message") {
      presence.getState().apply(event.message);
      movement.apply(event.message);
      onMessage?.(event.message, presence.getState());
    }
    if (event.type === "closed") pauseOnDisconnect();
    if (event.type === "stopped") {
      if (!isManuallyRecoverable(event.outcome)) {
        presence.getState().clear();
      }
      void onOutcome(event.outcome);
    }
  }

  const client = createRealtimeClient({ ...clientOptions, onEvent });
  let unbindMovement: (() => void) | undefined;

  // Mirrors the client's connect(): any other phase ignores the call, and
  // rebinding then would clear stepMs until a welcome that never comes.
  function opensOnConnect() {
    return ["idle", "closed"].includes(client.getStatus().phase);
  }

  function bindMovement() {
    unbindMovement?.();
    unbindMovement = movement.bind(client.send);
  }

  return {
    connect() {
      if (client.getStatus().phase !== "idle") return;
      bindMovement();
      client.connect();
    },
    reconnect() {
      if (!opensOnConnect()) return;
      bindMovement();
      client.connect();
    },
    rejoin() {
      if (client.getStatus().phase !== "connected") return false;
      client.close();
      pauseOnDisconnect();
      client.connect();
      return true;
    },
    close() {
      unbindMovement?.();
      client.close();
      presence.getState().clear();
    },
    getStatus: client.getStatus,
    subscribe: client.subscribe,
  };
}
