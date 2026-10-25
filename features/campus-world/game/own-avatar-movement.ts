import type { MapLayout } from "campus-world-map";

import type { Presence } from "@/core/presence";
import type {
  Direction,
  MoveCorrection,
  Player,
  WorldMovement,
  WorldMovementMessage,
} from "@/core/realtime";

import { interpolatePlayer } from "../services/movement/interpolate-player";
import { type PendingMove, reconcile } from "../services/movement/reconcile";
import { predictStep } from "../services/movement/step";

export interface MovementInput {
  deltaMs: number;
  held: readonly Direction[];
  pressed: Direction | null;
}

export interface OwnAvatarMovement {
  readPlayer(): Player | undefined;
  stop(): void;
  update(input: MovementInput): void;
}

interface OwnAvatarMovementOptions {
  layout: MapLayout;
  movement: WorldMovement;
  onMoveCorrected: (outcome: MoveCorrection) => void;
  prefersReducedMotion: () => boolean;
  readPresence: () => Presence;
}

interface StepAnimation {
  durationMs: number;
  elapsedMs: number;
  from: Player;
  to: Player;
}

function samePlayer(first: Player, second: Player): boolean {
  return (
    first.userId === second.userId &&
    first.x === second.x &&
    first.y === second.y &&
    first.facing === second.facing
  );
}

export function createOwnAvatarMovement({
  layout,
  movement,
  onMoveCorrected,
  prefersReducedMotion,
  readPresence,
}: OwnAvatarMovementOptions): OwnAvatarMovement {
  let animation: StepAnimation | undefined;
  let buffered: Direction | undefined;
  let displayed: Player | undefined;
  let heldOrder: Direction[] = [];
  let pending: PendingMove[] = [];
  let predicted: Player | undefined;
  let sequence = 0;

  function takePresencePosition() {
    const { positions, selfId } = readPresence();
    const position = selfId === null ? undefined : positions.get(selfId);
    predicted =
      selfId === null || !position
        ? undefined
        : { userId: selfId, ...position };
    displayed = predicted;
    animation = undefined;
    buffered = undefined;
    pending = [];
  }

  function receive(message: WorldMovementMessage) {
    if (message.type === "snapshot") {
      takePresencePosition();
      return;
    }
    if (message.type !== "moveResult" || !predicted) return;

    const before = predicted;
    const reconciled = reconcile(pending, message, layout);
    pending = reconciled.pending;
    predicted = reconciled.player;

    const corrected = !samePlayer(before, reconciled.player);
    if (corrected) {
      displayed = reconciled.player;
      if (animation) {
        const remainingMs = Math.max(
          0,
          animation.durationMs - animation.elapsedMs,
        );
        animation =
          remainingMs === 0
            ? undefined
            : {
                durationMs: remainingMs,
                elapsedMs: 0,
                from: reconciled.player,
                to: reconciled.player,
              };
      }
    }

    if (corrected && message.outcome !== "moved") {
      onMoveCorrected(message.outcome);
    }
  }

  // Returns how far the frame ran past the end of the step, so the next step
  // starts that far in and held walking keeps world's pace. A stalled frame
  // carries nothing: after it, only one new step starts.
  function advanceAnimation(deltaMs: number): number {
    if (!animation) return 0;

    const { durationMs } = animation;
    const elapsedMs = animation.elapsedMs + Math.max(0, deltaMs);
    animation.elapsedMs = Math.min(durationMs, elapsedMs);
    const progress = animation.elapsedMs / durationMs;
    displayed = prefersReducedMotion()
      ? animation.to
      : interpolatePlayer(animation.from, animation.to, progress);
    if (progress < 1) return 0;

    animation = undefined;
    return deltaMs < durationMs ? elapsedMs - durationMs : 0;
  }

  function beginStep(direction: Direction, carriedMs: number): boolean {
    const stepMs = movement.readStepMs();
    if (!predicted || stepMs === null) return false;

    const nextSequence = sequence + 1;
    if (!movement.sendMove({ direction, seq: nextSequence })) return false;

    const from = displayed ?? predicted;
    const next = predictStep(predicted, direction, layout);
    sequence = nextSequence;
    pending = [...pending, { direction, seq: sequence }];
    predicted = next;
    animation = {
      durationMs: stepMs,
      elapsedMs: 0,
      from: { ...from, facing: next.facing },
      to: next,
    };
    advanceAnimation(carriedMs);
    return true;
  }

  takePresencePosition();
  const unsubscribe = movement.subscribe(receive);

  return {
    readPlayer: () => displayed,
    stop: unsubscribe,
    update({ deltaMs, held, pressed }) {
      if (!predicted) takePresencePosition();

      heldOrder = heldOrder.filter((direction) => held.includes(direction));
      if (pressed) {
        heldOrder = heldOrder.filter((direction) => direction !== pressed);
        heldOrder.push(pressed);
        if (animation) buffered = pressed;
      }

      const carriedMs = advanceAnimation(deltaMs);
      if (animation) return;

      const direction = buffered ?? pressed ?? heldOrder.at(-1);
      if (!direction) return;
      if (beginStep(direction, carriedMs)) buffered = undefined;
    },
  };
}
