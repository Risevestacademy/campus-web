import type {
  Avatar,
  Player,
  ServerMessage,
  SnapshotMessage,
} from "@/core/realtime";

export type Participant = Pick<Avatar, "userId" | "displayName" | "spriteKey">;
export type Position = Pick<Player, "x" | "y" | "facing">;
export type WorldMap = SnapshotMessage["map"];

export interface Presence {
  selfId: string | null;
  map: WorldMap | null;
  participants: ReadonlyMap<string, Participant>;
  positions: ReadonlyMap<string, Position>;
}

export const EMPTY_PRESENCE: Presence = {
  selfId: null,
  map: null,
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

function positionOf({ x, y, facing }: Player, map: WorldMap): Position {
  return {
    x: Math.min(x, map.width - 1),
    y: Math.min(y, map.height - 1),
    facing,
  };
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
  map: WorldMap,
): Pick<Presence, "participants" | "positions"> {
  return {
    participants: new Map(
      players.map((player) => [player.userId, participantOf(player)]),
    ),
    positions: new Map(
      players.map((player) => [player.userId, positionOf(player, map)]),
    ),
  };
}

function moveKnown(presence: Presence, players: readonly Player[]): Presence {
  if (!presence.map) return presence;
  const known = players.filter(({ userId }) => presence.positions.has(userId));
  if (known.length === 0) return presence;

  const positions = new Map(presence.positions);
  for (const player of known) {
    positions.set(player.userId, positionOf(player, presence.map));
  }
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
      return {
        ...presence,
        map: message.map,
        ...rebuild(message.players, message.map),
      };
    case "joined":
      if (!presence.map) return presence;
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
          positionOf(message.player, presence.map),
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

export function withoutRemoteParticipants(presence: Presence): Presence {
  const selfId = presence.selfId;
  if (!selfId)
    return { ...presence, participants: new Map(), positions: new Map() };
  const participant = presence.participants.get(selfId);
  const position = presence.positions.get(selfId);
  return {
    ...presence,
    participants: participant ? new Map([[selfId, participant]]) : new Map(),
    positions: position ? new Map([[selfId, position]]) : new Map(),
  };
}
