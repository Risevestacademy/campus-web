import type { Presence } from "@/core/presence";
import type { Direction } from "@/core/realtime";

import { tileCentre, type TileSize } from "../tile-centre";
import { escapeStyledText } from "./avatar-label";

export interface AvatarDraw {
  userId: string;
  x: number;
  y: number;
  facing: Direction;
  label: string | null;
  isSelf: boolean;
}

// Sorted by row so a nearer avatar is drawn over a farther one.
export function buildAvatarDrawList(
  { participants, positions, selfId }: Presence,
  tile: TileSize,
): AvatarDraw[] {
  const list: AvatarDraw[] = [];

  for (const [userId, participant] of participants) {
    const position = positions.get(userId);
    if (!position) continue;

    list.push({
      userId,
      ...tileCentre(position, tile),
      facing: position.facing,
      label:
        participant.displayName === null
          ? null
          : escapeStyledText(participant.displayName),
      isSelf: userId === selfId,
    });
  }

  return list.sort((first, second) => first.y - second.y);
}
