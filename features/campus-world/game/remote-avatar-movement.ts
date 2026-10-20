import type { MapLayout } from "campus-world-map";

import type { Presence } from "@/core/presence";
import type {
  Direction,
  Player,
  WorldMovement,
  WorldMovementMessage,
} from "@/core/realtime";

import { interpolatePlayer } from "../services/movement/interpolate-player";
import { walkPath } from "../services/movement/walk-path";

const MAX_QUEUED_STEPS = 4;

export interface RemoteAvatarMovement {
  readPlayers(): ReadonlyMap<string, Player>;
  stop(): void;
  update(deltaMs: number): void;
}

interface RemoteAvatarMovementOptions {
  layout: MapLayout;
  movement: WorldMovement;
  prefersReducedMotion: () => boolean;
  readPresence: () => Presence;
}

interface RemoteState {
  displayed: Player;
  elapsedMs: number;
  from: Player;
  queued: Player[];
  target: Player;
}

function walkingDirection(
  from: Player,
  to: { x: number; y: number },
): Direction {
  if (to.x > from.x) return "right";
  if (to.x < from.x) return "left";
  if (to.y < from.y) return "up";
  return "down";
}

function playerOf({ userId, x, y, facing }: Player): Player {
  return { userId, x, y, facing };
}

export function createRemoteAvatarMovement({
  layout,
  movement,
  prefersReducedMotion,
  readPresence,
}: RemoteAvatarMovementOptions): RemoteAvatarMovement {
  const players = new Map<string, Player>();
  const states = new Map<string, RemoteState>();
  let selfId = readPresence().selfId;

  function add(player: Player) {
    const placed = playerOf(player);
    players.set(placed.userId, placed);
    states.set(placed.userId, {
      displayed: placed,
      elapsedMs: 0,
      from: placed,
      queued: [],
      target: placed,
    });
  }

  function rebuildFromPresence() {
    const presence = readPresence();
    selfId = presence.selfId;
    players.clear();
    states.clear();
    for (const [userId, position] of presence.positions) {
      if (userId !== selfId) add({ userId, ...position });
    }
  }

  rebuildFromPresence();

  function snap(state: RemoteState, target: Player) {
    state.displayed = target;
    state.elapsedMs = 0;
    state.from = target;
    state.queued = [];
    state.target = target;
    players.set(target.userId, target);
  }

  function receive(message: WorldMovementMessage) {
    if (message.type === "snapshot") {
      rebuildFromPresence();
      return;
    }
    if (message.type === "joined") {
      if (message.player.userId !== selfId) add(message.player);
      return;
    }
    if (message.type === "left") {
      players.delete(message.userId);
      states.delete(message.userId);
      return;
    }
    if (message.type !== "moved") return;

    for (const moved of message.players) {
      const state = states.get(moved.userId);
      if (!state) continue;

      const target = playerOf(moved);
      const path = walkPath(state.target, target, layout);
      if (path?.length === 0) {
        state.target = target;
        if (state.queued.length === 0) snap(state, target);
        continue;
      }
      if (
        !path ||
        prefersReducedMotion() ||
        state.queued.length + path.length > MAX_QUEUED_STEPS
      ) {
        snap(state, target);
        continue;
      }

      let previous = state.target;
      state.target = target;
      for (const tile of path) {
        const queued = {
          userId: target.userId,
          ...tile,
          facing: walkingDirection(previous, tile),
        };
        state.queued.push(queued);
        previous = queued;
      }
    }
  }

  const unsubscribe = movement.subscribe(receive);

  return {
    readPlayers: () => players,
    stop: unsubscribe,
    update(deltaMs) {
      if (prefersReducedMotion()) {
        for (const state of states.values()) snap(state, state.target);
        return;
      }

      const stepMs = movement.readStepMs();
      if (stepMs === null) return;

      for (const state of states.values()) {
        if (state.queued.length === 0) continue;
        let elapsedMs = state.elapsedMs + Math.max(0, deltaMs);

        while (state.queued.length > 0 && elapsedMs >= stepMs) {
          state.displayed = state.queued.shift()!;
          state.from = state.displayed;
          elapsedMs -= stepMs;
        }

        const next = state.queued[0];
        if (next) {
          const from = { ...state.from, facing: next.facing };
          state.displayed = interpolatePlayer(from, next, elapsedMs / stepMs);
        } else {
          state.displayed = { ...state.displayed, facing: state.target.facing };
          elapsedMs = 0;
        }
        state.elapsedMs = elapsedMs;
        players.set(state.displayed.userId, state.displayed);
      }
    },
  };
}
