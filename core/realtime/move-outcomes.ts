import type { MoveOutcome, WalkEndReason } from "./generated/world-protocol";

// Every answer but `moved`: world kept the avatar off the tile it asked for.
export const MOVE_CORRECTIONS = [
  "blocked",
  "refused",
  "too_fast",
] as const satisfies readonly MoveOutcome[];

export const MOVE_OUTCOMES = [
  "moved",
  ...MOVE_CORRECTIONS,
] as const satisfies readonly MoveOutcome[];

export const WALK_END_REASONS = [
  "arrived",
  "stopped",
  "refused",
  "gone",
  "elsewhere",
  "no_way",
  "moved_by_staff",
] as const satisfies readonly WalkEndReason[];
