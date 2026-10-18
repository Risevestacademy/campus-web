import type { MoveMessage } from "./generated/world-protocol";
import type { ServerMessage } from "./server-message.schema";

export type WorldMovementMessage = Extract<
  ServerMessage,
  { type: "welcome" | "snapshot" | "moveResult" }
>;

export interface WorldMovement {
  readStepMs(): number | null;
  sendMove(move: Pick<MoveMessage, "direction" | "seq">): boolean;
  subscribe(listener: (message: WorldMovementMessage) => void): () => void;
}

export interface WorldMovementChannel extends WorldMovement {
  apply(message: ServerMessage): void;
  bind(send: (message: MoveMessage) => boolean): () => void;
  disconnect(): void;
}

export function createWorldMovementChannel(): WorldMovementChannel {
  const listeners = new Set<(message: WorldMovementMessage) => void>();
  let binding = 0;
  let ready = false;
  let send: ((message: MoveMessage) => boolean) | undefined;
  let stepMs: number | null = null;

  function publish(message: WorldMovementMessage) {
    for (const listener of listeners) listener(message);
  }

  return {
    apply(message) {
      if (message.type === "welcome") {
        ready = false;
        stepMs = message.stepMs;
        publish(message);
      } else if (message.type === "snapshot") {
        ready = stepMs !== null;
        publish(message);
      } else if (message.type === "moveResult") {
        publish(message);
      }
    },
    bind(nextSend) {
      binding += 1;
      const currentBinding = binding;
      send = nextSend;

      return () => {
        if (binding !== currentBinding) return;
        send = undefined;
        ready = false;
        stepMs = null;
      };
    },
    disconnect() {
      ready = false;
    },
    readStepMs: () => (ready ? stepMs : null),
    sendMove(move) {
      if (!ready || !send) return false;
      return send({ type: "move", ...move });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const cohortChannels = new Map<string, WorldMovementChannel>();

export function movementFor(cohortId: string): WorldMovementChannel {
  let channel = cohortChannels.get(cohortId);
  if (!channel) {
    channel = createWorldMovementChannel();
    cohortChannels.set(cohortId, channel);
  }
  return channel;
}
