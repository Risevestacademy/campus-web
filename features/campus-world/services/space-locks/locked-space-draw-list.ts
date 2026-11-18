import type { Bounds, Space } from "campus-world-map";

import {
  isSpaceLocked,
  ownSpaceKeyOf,
  type Presence,
  spaceNameOf,
} from "@/core/presence";

import { escapeStyledText } from "../avatars/avatar-label";
import type { TileSize } from "../tile-centre";

export interface Point {
  x: number;
  y: number;
}

export interface LockedSpaceDraw {
  key: string;
  // The space's outline in pixels, clockwise from its top left.
  outline: Point[];
  // Hatching is clipped to a box, so only a rectangle gets it; a polygon is
  // shaded and outlined instead.
  hatched: boolean;
  // Where the name plate sits: the middle of the space's bottom edge.
  plate: Point;
  label: string;
}

export interface Segment {
  from: Point;
  to: Point;
}

function outlineOf(bounds: Bounds, { tilewidth, tileheight }: TileSize) {
  const points =
    bounds.shape === "rect"
      ? [
          { x: bounds.x, y: bounds.y },
          { x: bounds.x + bounds.width, y: bounds.y },
          { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
          { x: bounds.x, y: bounds.y + bounds.height },
        ]
      : bounds.points;
  return points.map(({ x, y }) => ({ x: x * tilewidth, y: y * tileheight }));
}

function bottomCentre(outline: readonly Point[]): Point {
  const xs = outline.map(({ x }) => x);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: Math.max(...outline.map(({ y }) => y)),
  };
}

// Everyone outside a locked space sees it locked; whoever is inside already
// has the header's lock to tell them.
export function buildLockedSpaceDrawList(
  spaces: readonly Space[],
  presence: Pick<
    Presence,
    "selfId" | "participants" | "lockedSpaces" | "spaceNames"
  >,
  tile: TileSize,
): LockedSpaceDraw[] {
  if (presence.lockedSpaces.length === 0) return [];
  const ownSpace = ownSpaceKeyOf(presence);

  return spaces
    .filter(({ key }) => key !== ownSpace && isSpaceLocked(presence, key))
    .map(({ key, bounds }) => {
      const outline = outlineOf(bounds, tile);
      return {
        key,
        outline,
        hatched: bounds.shape === "rect",
        plate: bottomCentre(outline),
        label: escapeStyledText(spaceNameOf(presence, key)),
      };
    });
}

// Diagonal hatch lines across a box, `spacing` pixels apart, each clipped to
// the box so a frame never draws past the space.
export function hatchSegments(
  outline: readonly Point[],
  spacing: number,
): Segment[] {
  const xs = outline.map(({ x }) => x);
  const ys = outline.map(({ y }) => y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const segments: Segment[] = [];

  for (let sum = left + top + spacing; sum < right + bottom; sum += spacing) {
    const fromX = Math.max(left, sum - bottom);
    const toX = Math.min(right, sum - top);
    if (toX <= fromX) continue;
    segments.push({
      from: { x: fromX, y: sum - fromX },
      to: { x: toX, y: sum - toX },
    });
  }
  return segments;
}
