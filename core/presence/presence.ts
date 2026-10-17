import type { Avatar, Player, ServerMessage } from "@/core/realtime";

export type Participant = Pick<Avatar, "userId" | "displayName" | "spriteKey">;
export type Position = Pick<Player, "x" | "y" | "facing">;

export interface Presence {
  selfId: string | null;
  participants: ReadonlyMap<string, Participant>;
  positions: ReadonlyMap<string, Position>;
}

export const EMPTY_PRESENCE: Presence = {
  selfId: null,
  participants: new Map(),
  positions: new Map(),
};

function participantOf({
  userId,
  displayName,
  spriteKey,
}: Participant): Participant {
  return { userId, displayName, spriteKey };
}

function positionOf({ x, y, facing }: Player): Position {
  return { x, y, facing };
}

function withEntry<Value>(
  map: ReadonlyMap<string, Value>,
  key: string,
  value: Value,
): ReadonlyMap<string, Value> {
  return new Map(map).set(key, value);
}

function withoutEntry<Value>(
  map: ReadonlyMap<string, Value>,
  key: string,
): ReadonlyMap<string, Value> {
  const next = new Map(map);
  next.delete(key);
  return next;
}

function rebuild(
  players: readonly Avatar[],
): Pick<Presence, "participants" | "positions"> {
  return {
    participants: new Map(
      players.map((player) => [player.userId, participantOf(player)]),
    ),
    positions: new Map(
      players.map((player) => [player.userId, positionOf(player)]),
    ),
  };
}

function moveKnown(presence: Presence, players: readonly Player[]): Presence {
  const known = players.filter(({ userId }) => presence.positions.has(userId));
  if (known.length === 0) return presence;

  const positions = new Map(presence.positions);
  for (const player of known) positions.set(player.userId, positionOf(player));
  return { ...presence, positions };
}

// A snapshot replaces both maps: after a reconnect, patching the old roster
// would keep whoever left while the socket was down.
export function applyServerMessage(
  presence: Presence,
  message: ServerMessage,
): Presence {
  switch (message.type) {
    case "welcome":
      return { ...presence, selfId: message.userId };
    case "snapshot":
      return { ...presence, ...rebuild(message.players) };
    case "joined":
      return {
        ...presence,
        participants: withEntry(
          presence.participants,
          message.player.userId,
          participantOf(message.player),
        ),
        positions: withEntry(
          presence.positions,
          message.player.userId,
          positionOf(message.player),
        ),
      };
    case "appearance":
      if (!presence.participants.has(message.userId)) return presence;
      return {
        ...presence,
        participants: withEntry(
          presence.participants,
          message.userId,
          participantOf(message),
        ),
      };
    case "left":
      if (!presence.participants.has(message.userId)) return presence;
      return {
        ...presence,
        participants: withoutEntry(presence.participants, message.userId),
        positions: withoutEntry(presence.positions, message.userId),
      };
    case "moved":
      return moveKnown(presence, message.players);
    case "moveResult":
      return message.player.userId === presence.selfId
        ? moveKnown(presence, [message.player])
        : presence;
    default:
      return presence;
  }
}
