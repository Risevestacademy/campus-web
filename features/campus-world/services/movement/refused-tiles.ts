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

// How long a full space stays shut to the prediction. Capacity frees up as
// people leave, so it is not kept like a wall: long enough that a key held
// against the door stops snapping the avatar back on every step, short enough
// that the next try after someone leaves goes through.
export const FULL_TILE_MEMORY_MS = 3000;

export interface FullTile extends Tile {
  readonly until: number;
}

// A `full` answer shuts the tile the person faces until `nowMs` plus the
// memory. Asked again before then, the tile's time is only renewed.
export function rememberFullTile(
  full: readonly FullTile[],
  { outcome, player }: MoveAnswer,
  nowMs: number,
): readonly FullTile[] {
  if (outcome !== "full") return full;

  const faced = stepFrom(player, player.facing);
  return [
    ...full.filter((tile) => !sameTile(tile, faced)),
    { ...faced, until: nowMs + FULL_TILE_MEMORY_MS },
  ];
}

export function forgetStaleFullTiles(
  full: readonly FullTile[],
  nowMs: number,
): readonly FullTile[] {
  return full.some(({ until }) => until <= nowMs)
    ? full.filter(({ until }) => until > nowMs)
    : full;
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
