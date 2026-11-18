import type { Player } from "@/core/realtime";

export function interpolatePlayer(
  from: Player,
  to: Player,
  progress: number,
): Player {
  return {
    ...to,
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}
