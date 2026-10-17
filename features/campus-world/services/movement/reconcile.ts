import type { MapLayout } from "campus-world-map";

import type { MoveMessage, MoveResultMessage, Player } from "@/core/realtime";

import { predictStep } from "./step";

export type PendingMove = Pick<MoveMessage, "direction" | "seq">;

export interface Reconciled {
  pending: PendingMove[];
  player: Player;
}

// world's `player` is the truth whatever the outcome, so `outcome` is never
// read: an outcome added upstream snaps back like `blocked` does.
export function reconcile(
  pending: readonly PendingMove[],
  result: Pick<MoveResultMessage, "player" | "seq">,
  layout: MapLayout,
): Reconciled {
  const unanswered = pending.filter((move) => move.seq > result.seq);
  const player = unanswered.reduce(
    (position, move) => predictStep(position, move.direction, layout),
    result.player,
  );
  return { pending: unanswered, player };
}
