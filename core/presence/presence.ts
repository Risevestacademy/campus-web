import type {
  Avatar,
  Player,
  ServerMessage,
  SnapshotMessage,
} from "@/core/realtime";

export type Participant = Pick<
  Avatar,
  "userId" | "displayName" | "spriteKey" | "status" | "spaceKey"
>;
export type Position = Pick<Player, "x" | "y" | "facing">;
export type WorldMap = SnapshotMessage["map"];

export interface Presence {
  selfId: string | null;
  map: WorldMap | null;
  // True from a snapshot until the socket closes. The map outlives a closed
  // socket so the scene stays drawn, but who is online is unknown until the
  // next snapshot.
  synced: boolean;
  participants: ReadonlyMap<string, Participant>;
  positions: ReadonlyMap<string, Position>;
  spaceNames: ReadonlyMap<string, string>;
  nearby: readonly string[];
  // Counts each time somebody comes near after nobody was. A view opened for
  // one encounter must not reopen by itself for the next.
  encounter: number;
}

export const EMPTY_PRESENCE: Presence = {
  selfId: null,
  map: null,
  synced: false,
  participants: new Map(),
  positions: new Map(),
  spaceNames: new Map(),
  nearby: [],
  encounter: 0,
};

function participantOf({
  userId,
  displayName,
  spriteKey,
  status,
  spaceKey,
}: Participant): Participant {
  return { userId, displayName, spriteKey, status, spaceKey };
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

function spaceNamesOf(
  spaces: SnapshotMessage["spaces"],
): ReadonlyMap<string, string> {
  return new Map(spaces.map(({ spaceKey, name }) => [spaceKey, name]));
}

function withParticipantChange(
  presence: Presence,
  userId: string,
  change: Partial<Participant>,
): Presence {
  const participant = presence.participants.get(userId);
  if (!participant) return presence;
  return {
    ...presence,
    participants: withEntry(presence.participants, userId, {
      ...participant,
      ...change,
    }),
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

function inArrivalOrder(
  current: readonly string[],
  next: readonly string[],
): readonly string[] {
  const nextIds = new Set(next);
  const stillNear = current.filter((userId) => nextIds.has(userId));
  const arrived = [...nextIds].filter((userId) => !current.includes(userId));
  return [...stillNear, ...arrived];
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((userId, index) => userId === right[index])
  );
}

function withNearby(presence: Presence, userIds: readonly string[]): Presence {
  const nearby = inArrivalOrder(presence.nearby, userIds);
  if (sameIds(nearby, presence.nearby)) return presence;
  const encounter =
    presence.nearby.length === 0 ? presence.encounter + 1 : presence.encounter;
  return { ...presence, nearby, encounter };
}

// A snapshot replaces who is here, where, and who is near: after a reconnect,
// patching the old roster would keep whoever left while the socket was down.
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
        synced: true,
        ...rebuild(message.players, message.map),
        spaceNames: spaceNamesOf(message.spaces),
        nearby: [],
      };
    case "spaces":
      return { ...presence, spaceNames: spaceNamesOf(message.spaces) };
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
      return withParticipantChange(presence, message.userId, {
        displayName: message.displayName,
        spriteKey: message.spriteKey,
      });
    case "statusChanged":
      return withParticipantChange(presence, message.userId, {
        status: message.status,
      });
    case "spaceChanged":
      return withParticipantChange(presence, message.userId, {
        spaceKey: message.spaceKey,
      });
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
    case "nearby":
      return withNearby(presence, message.userIds);
    default:
      return presence;
  }
}

export function spaceNameOf(
  { spaceNames }: Pick<Presence, "spaceNames">,
  spaceKey: string,
): string {
  return spaceNames.get(spaceKey) ?? spaceKey;
}

export function withoutRemoteParticipants(presence: Presence): Presence {
  const selfId = presence.selfId;
  const participant = selfId ? presence.participants.get(selfId) : undefined;
  const position = selfId ? presence.positions.get(selfId) : undefined;
  return {
    ...presence,
    synced: false,
    participants:
      selfId && participant ? new Map([[selfId, participant]]) : new Map(),
    positions: selfId && position ? new Map([[selfId, position]]) : new Map(),
    nearby: [],
  };
}
