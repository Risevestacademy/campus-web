import type { MapLayout } from "campus-world-map";

import type { Presence } from "@/core/presence";
import type {
  Direction,
  MoveOutcome,
  Player,
  WorldMovement,
  WorldMovementMessage,
} from "@/core/realtime";

import { interpolatePlayer } from "../services/movement/interpolate-player";
import { type PendingMove, reconcile } from "../services/movement/reconcile";
import { predictStep } from "../services/movement/step";

export type MoveCorrectionOutcome = Exclude<MoveOutcome, "moved">;

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
  onMoveCorrected: (outcome: MoveCorrectionOutcome) => void;
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

    if (!samePlayer(before, reconciled.player)) {
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

    if (message.outcome !== "moved") onMoveCorrected(message.outcome);
  }

  function advanceAnimation(deltaMs: number) {
    if (!animation) return;

    animation.elapsedMs = Math.min(
      animation.durationMs,
      animation.elapsedMs + Math.max(0, deltaMs),
    );
    const progress = animation.elapsedMs / animation.durationMs;
    displayed = prefersReducedMotion()
      ? animation.to
      : interpolatePlayer(animation.from, animation.to, progress);
    if (progress === 1) animation = undefined;
  }

  function beginStep(direction: Direction): boolean {
    const stepMs = movement.readStepMs();
    if (!predicted || stepMs === null) return false;

    const nextSequence = sequence + 1;
    if (!movement.sendMove({ direction, seq: nextSequence })) return false;

    const from = displayed ?? predicted;
    const next = predictStep(predicted, direction, layout);
    sequence = nextSequence;
    pending = [...pending, { direction, seq: sequence }];
    predicted = next;
    displayed = prefersReducedMotion()
      ? next
      : { ...from, facing: next.facing };
    animation = {
      durationMs: stepMs,
      elapsedMs: 0,
      from: { ...from, facing: next.facing },
      to: next,
    };
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

      advanceAnimation(deltaMs);
      if (animation) return;

      const direction = buffered ?? pressed ?? heldOrder.at(-1);
      if (!direction) return;
      if (beginStep(direction)) buffered = undefined;
    },
  };
}
