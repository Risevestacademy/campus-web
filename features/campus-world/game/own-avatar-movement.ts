import type { MapLayout, Tile } from "campus-world-map";

import type { Presence } from "@/core/presence";
import type {
  Direction,
  MoveCorrection,
  Player,
  WalkEndedMessage,
  WalkingMessage,
  WorldMovement,
  WorldMovementMessage,
} from "@/core/realtime";

import { interpolatePlayer } from "../services/movement/interpolate-player";
import { type PendingMove, reconcile } from "../services/movement/reconcile";
import {
  learnRefusedTiles,
  withRefusedTiles,
} from "../services/movement/refused-tiles";
import { predictStep, stepFrom } from "../services/movement/step";

export interface MovementInput {
  deltaMs: number;
  held: readonly Direction[];
  pressed: Direction | null;
}

export interface OwnAvatarMovement {
  readPlayer(): Player | undefined;
  stop(): void;
  // True once for each walk world starts, so the camera returns to the avatar
  // without taking back a drag made mid-walk.
  takeWalkStarted(): boolean;
  update(input: MovementInput): void;
}

interface OwnAvatarMovementOptions {
  layout: MapLayout;
  movement: WorldMovement;
  onMoveCorrected: (outcome: MoveCorrection) => void;
  // Every refused step, with the tile world kept the member off.
  onStepRefused?: (tile: Tile) => void;
  prefersReducedMotion: () => boolean;
  readPresence: () => Presence;
}

interface StepAnimation {
  durationMs: number;
  elapsedMs: number;
  from: Player;
  fromWorld: boolean;
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
  onStepRefused,
  prefersReducedMotion,
  readPresence,
}: OwnAvatarMovementOptions): OwnAvatarMovement {
  let animation: StepAnimation | undefined;
  let buffered: Direction | undefined;
  let displayed: Player | undefined;
  let heldOrder: Direction[] = [];
  let onWalk = false;
  let pending: PendingMove[] = [];
  let predicted: Player | undefined;
  let refused: readonly Tile[] = [];
  let sequence = 0;
  let walkStarted = false;

  function walkable(): MapLayout {
    return withRefusedTiles(layout, refused);
  }

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
    refused = [];
  }

  function showWorldStep(player: Player) {
    if (!predicted || samePlayer(predicted, player)) return;

    const from = predicted;
    const stepMs = movement.readStepMs();
    predicted = player;
    const distance = Math.abs(from.x - player.x) + Math.abs(from.y - player.y);
    if (stepMs === null || distance !== 1) {
      displayed = player;
      animation = undefined;
      return;
    }
    // Catch up to the previous server tile before starting the next step.
    // Starting at the partly drawn position would cut corners on early frames.
    animation = {
      durationMs: stepMs,
      elapsedMs: 0,
      from: { ...from, facing: player.facing },
      fromWorld: true,
      to: player,
    };
    advanceAnimation(0);
  }

  function followWalk(message: WalkingMessage | WalkEndedMessage) {
    const walking = message.type === "walking";
    if (walking && !onWalk) walkStarted = true;
    onWalk = walking;

    // A key press ended the walk. World answers it after this frame, and that
    // moveResult is the truth, so this older position must not replace it.
    if (pending.length === 0) showWorldStep(message.player);
  }

  function receive(message: WorldMovementMessage) {
    if (message.type === "snapshot") {
      onWalk = false;
      walkStarted = false;
      takePresencePosition();
      return;
    }
    if (message.type === "walking" || message.type === "walkEnded") {
      followWalk(message);
      return;
    }
    if (message.type !== "moveResult" || !predicted) return;

    if (message.outcome === "refused") {
      onStepRefused?.(stepFrom(message.player, message.player.facing));
    }
    refused = learnRefusedTiles(refused, message);
    const before = predicted;
    const reconciled = reconcile(pending, message, walkable());
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
                fromWorld: false,
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

    const from = animation?.fromWorld ? predicted : (displayed ?? predicted);
    const next = predictStep(predicted, direction, walkable());
    sequence = nextSequence;
    pending = [...pending, { direction, seq: sequence }];
    predicted = next;
    animation = {
      durationMs: stepMs,
      elapsedMs: 0,
      from: { ...from, facing: next.facing },
      fromWorld: false,
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
    takeWalkStarted() {
      const started = walkStarted;
      walkStarted = false;
      return started;
    },
    update({ deltaMs, held, pressed }) {
      if (!predicted) takePresencePosition();

      heldOrder = heldOrder.filter((direction) => held.includes(direction));
      if (pressed) {
        heldOrder = heldOrder.filter((direction) => direction !== pressed);
        heldOrder.push(pressed);
        if (animation) buffered = pressed;
      }

      const carriedMs = advanceAnimation(deltaMs);
      const direction = buffered ?? pressed ?? heldOrder.at(-1);
      // World's steps arrive back to back, so waiting for one to finish could
      // starve the key press that ends the walk.
      if (animation && !(animation.fromWorld && direction)) return;
      if (!direction) return;
      if (beginStep(direction, carriedMs)) buffered = undefined;
    },
  };
}
