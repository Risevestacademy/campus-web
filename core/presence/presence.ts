import {
  type Avatar,
  type Call,
  type Player,
  type ServerMessage,
  type SnapshotMessage,
  spaceIdOfRoom,
} from "@/core/realtime";

import {
  EMPTY_SOCIAL,
  type Social,
  socialChangeOf,
  socialOfSnapshot,
  withoutSocketState,
} from "./social";

export type Participant = Pick<
  Avatar,
  "userId" | "displayName" | "spriteKey" | "status" | "statusUntil" | "spaceKey"
>;
export type Position = Pick<Player, "x" | "y" | "facing">;
export type WorldMap = SnapshotMessage["map"];
export type Hearing = Exclude<Call["hearing"], "unknown">;
// After a crossing or a snapshot World always sends the space's call, but
// only once it has minted a token: until then the old call says nothing.
type PresenceHearing = Hearing | "awaiting" | null;

export interface Presence extends Social {
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
  hearing: PresenceHearing;
  meetingRoster: readonly string[];
  // A view opened for one encounter must not reopen by itself for the next.
  encounter: number;
  // When, by this device's clock, the member came into the space they stand
  // in. Chat starts over then, so its lines begin from here.
  spaceEnteredAt: number | null;
  // The campus-api space whose call you are in, read from the call's room, for
  // routes keyed by it. Null where the space has no call (the corridors), and
  // until world sends the call after a crossing or a snapshot.
  spaceId: string | null;
}

export const EMPTY_PRESENCE: Presence = {
  selfId: null,
  map: null,
  synced: false,
  participants: new Map(),
  positions: new Map(),
  spaceNames: new Map(),
  nearby: [],
  hearing: null,
  meetingRoster: [],
  encounter: 0,
  spaceEnteredAt: null,
  spaceId: null,
  ...EMPTY_SOCIAL,
};

export function hearingOf(call: Call | null): Hearing | null {
  return call && call.hearing !== "unknown" ? call.hearing : null;
}

function participantOf({
  userId,
  displayName,
  spriteKey,
  status,
  statusUntil,
  spaceKey,
}: Participant): Participant {
  return { userId, displayName, spriteKey, status, statusUntil, spaceKey };
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

function namesBySpaceKey(
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
  return { ...presence, nearby };
}

function withHearing(presence: Presence, hearing: PresenceHearing): Presence {
  return hearing === presence.hearing ? presence : { ...presence, hearing };
}

function withSpaceId(presence: Presence, spaceId: string | null): Presence {
  return spaceId === presence.spaceId ? presence : { ...presence, spaceId };
}

// A World without media never sends a call, so only a held call is awaited.
function awaitingCall(hearing: PresenceHearing): PresenceHearing {
  return hearing === null ? null : "awaiting";
}

function ownSpaceOf({ selfId, participants }: Presence): string | undefined {
  return selfId === null ? undefined : participants.get(selfId)?.spaceKey;
}

// World keeps no chat and will not send it again, so leaving a space leaves
// its lines behind: the member's chat begins in the space they came into.
function withSpaceEntry(previous: Presence, next: Presence): Presence {
  const space = ownSpaceOf(next);
  if (space === undefined) return next;
  if (space === ownSpaceOf(previous) && next.spaceEnteredAt !== null) {
    return next;
  }
  return {
    ...next,
    spaceEnteredAt: Date.now(),
    chat: next.chat.filter(({ spaceKey }) => spaceKey === space),
  };
}

function withSpaceChange(
  presence: Presence,
  userId: string,
  spaceKey: string,
): Presence {
  const crossed =
    userId === presence.selfId &&
    presence.participants.get(userId)?.spaceKey !== spaceKey;
  const next = withParticipantChange(presence, userId, { spaceKey });
  return crossed
    ? withSpaceEntry(
        presence,
        withSpaceId(withHearing(next, awaitingCall(presence.hearing)), null),
      )
    : next;
}

function roomMateIds({ selfId, participants }: Presence): string[] {
  const self = selfId === null ? undefined : participants.get(selfId);
  if (!self) return [];
  return [...participants.values()]
    .filter(
      ({ userId, spaceKey }) => userId !== selfId && spaceKey === self.spaceKey,
    )
    .map(({ userId }) => userId);
}

// World only names people in your space, but its list lags a crossing by a
// tick, and the call that ends awaiting usually arrives first.
function knownNearbyIds({ selfId, participants, nearby }: Presence): string[] {
  const self = selfId === null ? undefined : participants.get(selfId);
  return nearby.filter((userId) => {
    const other = participants.get(userId);
    return (
      userId !== selfId &&
      other !== undefined &&
      (!self || other.spaceKey === self.spaceKey)
    );
  });
}

// World only names who is near in proximity spaces, and empties the list on
// entering a room space, so nearby is the roster without a room call.
function meetingCandidates(presence: Presence): string[] {
  switch (presence.hearing) {
    case "room":
      return roomMateIds(presence);
    case "awaiting":
      return [];
    default:
      return knownNearbyIds(presence);
  }
}

// Runs on every frame, movement ticks included, so it returns the same
// roster when nobody changed: a fresh one would re-render every subscriber.
function withMeetingRoster(previous: Presence, next: Presence): Presence {
  if (next === previous) return next;
  const meetingRoster = inArrivalOrder(
    previous.meetingRoster,
    meetingCandidates(next),
  );
  if (sameIds(meetingRoster, previous.meetingRoster)) return next;
  const encounter =
    previous.meetingRoster.length === 0 ? next.encounter + 1 : next.encounter;
  return { ...next, meetingRoster, encounter };
}

export function applyServerMessage(
  presence: Presence,
  message: ServerMessage,
): Presence {
  return withMeetingRoster(presence, applyFrame(presence, message));
}

function applyFrame(presence: Presence, message: ServerMessage): Presence {
  const social = socialChangeOf(
    presence,
    message,
    (userId) => presence.participants.get(userId)?.displayName ?? null,
  );
  if (social) return { ...presence, ...social };

  switch (message.type) {
    case "welcome":
      return { ...presence, selfId: message.userId };
    // A snapshot replaces who is here, where, and who is near: after a
    // reconnect, patching would keep whoever left while the socket was down.
    case "snapshot":
      return withSpaceEntry(presence, {
        ...presence,
        map: message.map,
        synced: true,
        ...rebuild(message.players, message.map),
        spaceNames: namesBySpaceKey(message.spaces),
        nearby: [],
        hearing: awaitingCall(presence.hearing),
        spaceId: null,
        ...socialOfSnapshot(message),
      });
    case "spaces":
      return { ...presence, spaceNames: namesBySpaceKey(message.spaces) };
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
        statusUntil: message.until,
      });
    case "spaceChanged":
      return withSpaceChange(presence, message.userId, message.spaceKey);
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
    case "walking":
    case "walkEnded":
      return message.player.userId === presence.selfId
        ? moveKnown(presence, [message.player])
        : presence;
    case "nearby":
      return withNearby(presence, message.userIds);
    case "call":
      return withSpaceId(
        withHearing(presence, hearingOf(message.call)),
        message.call?.room ? spaceIdOfRoom(message.call.room) : null,
      );
    default:
      return presence;
  }
}

// The key of the corridors and grounds: every tile outside a drawn space.
export const DEFAULT_SPACE_KEY = "_default";

export function spaceNameOf(
  { spaceNames }: Pick<Presence, "spaceNames">,
  spaceKey: string,
): string {
  return spaceNames.get(spaceKey) ?? spaceKey;
}

// World answers a choice only when the cohort sees a change, so the member's
// own is drawn at once and its `statusChanged`, if any, settles it.
export function withOwnStatus(
  presence: Presence,
  status: Participant["status"],
  statusUntil: Participant["statusUntil"],
): Presence {
  if (presence.selfId === null) return presence;
  return withParticipantChange(presence, presence.selfId, {
    status,
    statusUntil,
  });
}

export function withoutRemoteParticipants(presence: Presence): Presence {
  const selfId = presence.selfId;
  const participant = selfId ? presence.participants.get(selfId) : undefined;
  const position = selfId ? presence.positions.get(selfId) : undefined;
  return withMeetingRoster(presence, {
    ...presence,
    synced: false,
    participants:
      selfId && participant ? new Map([[selfId, participant]]) : new Map(),
    positions: selfId && position ? new Map([[selfId, position]]) : new Map(),
    nearby: [],
    ...withoutSocketState(),
  });
}
