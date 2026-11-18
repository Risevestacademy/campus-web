import type { MapLayout, Tile } from "campus-world-map";

import type { MoveResultMessage } from "@/core/realtime";

import { stepFrom } from "./step";

type MoveAnswer = Pick<MoveResultMessage, "outcome" | "player">;

function sameTile(first: Tile, second: Tile): boolean {
  return first.x === second.x && first.y === second.y;
}

// world refuses floor in a locked space, or a designated one the person is not
// listed for; the client sees neither, so it learns the tile from the answer.
// A `moved` answer onto the tile means the lock lifted, so it is forgotten.
export function learnRefusedTiles(
  refused: readonly Tile[],
  { outcome, player }: MoveAnswer,
): readonly Tile[] {
  if (outcome === "refused") {
    const faced = stepFrom(player, player.facing);
    return refused.some((tile) => sameTile(tile, faced))
      ? refused
      : [...refused, faced];
  }
  if (outcome === "moved") {
    return refused.filter((tile) => !sameTile(tile, player));
  }
  return refused;
}

export function withRefusedTiles(
  layout: MapLayout,
  refused: readonly Tile[],
): MapLayout {
  if (refused.length === 0) return layout;

  return {
    ...layout,
    collisions: [
      ...layout.collisions,
      ...refused.map(({ x, y }) => ({
        shape: "rect" as const,
        x,
        y,
        width: 1,
        height: 1,
      })),
    ],
  };
}
