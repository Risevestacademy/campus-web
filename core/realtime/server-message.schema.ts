import { z } from "zod";

import type { Simplify } from "@/core/api/schemas";
import { parseJson } from "@/shared/lib/parse-json";

import type {
  AppearanceMessage,
  Avatar as PublishedAvatar,
  BroadcastCall as PublishedBroadcastCall,
  BroadcastMessage as PublishedBroadcastMessage,
  Call as PublishedCall,
  CallMessage as PublishedCallMessage,
  Direction,
  EntryRequestedMessage as PublishedEntryRequestedMessage,
  EntryRequestEndedMessage as PublishedEntryRequestEndedMessage,
  EntryRequestOutcome as PublishedEntryRequestOutcome,
  ErrorMessage as PublishedErrorMessage,
  JoinedMessage as PublishedJoinedMessage,
  LeftMessage,
  LockableSpacesMessage as PublishedLockableSpacesMessage,
  LockChangedMessage as PublishedLockChangedMessage,
  MovedMessage,
  MoveOutcome as PublishedMoveOutcome,
  MoveResultMessage as PublishedMoveResultMessage,
  NearbyMessage,
  Player,
  PongMessage,
  ReplacedMessage,
  SaidMessage as PublishedSaidMessage,
  ServerMessage as PublishedServerMessage,
  SnapshotMessage as PublishedSnapshotMessage,
  SpaceChangedMessage,
  SpaceName,
  SpacesMessage,
  StaffActionMessage as PublishedStaffActionMessage,
  Status as PublishedStatus,
  StatusChangedMessage as PublishedStatusChangedMessage,
  WalkEndedMessage as PublishedWalkEndedMessage,
  WalkEndReason as PublishedWalkEndReason,
  WalkingMessage as PublishedWalkingMessage,
  WelcomeMessage as PublishedWelcomeMessage,
} from "./generated/world-protocol";
import { MOVE_OUTCOMES, WALK_END_REASONS } from "./move-outcomes";

// A value world added after the last `pnpm world:types` reads as "unknown",
// so the frame still arrives and the move it answers still resolves.
type OrUnknown<Value extends string> = Value | "unknown";

export type MoveOutcome = OrUnknown<PublishedMoveOutcome>;
export type MoveCorrection = Exclude<MoveOutcome, "moved">;
export type ErrorCode = OrUnknown<PublishedErrorMessage["code"]>;
export type PlayerStatus = OrUnknown<PublishedStatus>;
export type MoveResultMessage = Simplify<
  Omit<PublishedMoveResultMessage, "outcome"> & { outcome: MoveOutcome }
>;
export type ErrorMessage = Simplify<
  Omit<PublishedErrorMessage, "code"> & { code: ErrorCode }
>;
export type WalkEndReason = OrUnknown<PublishedWalkEndReason>;
export type WalkingMessage = Pick<PublishedWalkingMessage, "type" | "player">;
export type WalkEndedMessage = Simplify<
  Pick<PublishedWalkEndedMessage, "type" | "player" | "spaceKey"> & {
    reason: WalkEndReason;
  }
>;
export type Avatar = Simplify<
  Pick<
    PublishedAvatar,
    keyof Player | "displayName" | "spriteKey" | "spaceKey" | "statusUntil"
  > & { status: PlayerStatus }
>;
export type StatusChangedMessage = Simplify<
  Pick<PublishedStatusChangedMessage, "type" | "userId" | "until"> & {
    status: PlayerStatus;
  }
>;
export type WelcomeMessage = Simplify<
  Pick<
    PublishedWelcomeMessage,
    | "type"
    | "userId"
    | "connectionId"
    | "heartbeatSeconds"
    | "stepMs"
    | "tickMs"
    | "awayAfterSeconds"
    | "displayName"
    | "spriteKey"
  >
>;
// Locks arrive with the snapshot, and read as none when it names none.
export type SnapshotMessage = Simplify<
  Pick<PublishedSnapshotMessage, "type" | "map" | "spaces"> & {
    players: Avatar[];
    lockableSpaces?: string[];
    lockedSpaces?: string[];
  }
>;
export type EntryRequestOutcome = OrUnknown<PublishedEntryRequestOutcome>;
export type StaffAction = OrUnknown<PublishedStaffActionMessage["action"]>;
export type SaidMessage = Pick<
  PublishedSaidMessage,
  "type" | "id" | "userId" | "spaceKey" | "text" | "at"
>;
export type EntryRequestedMessage = Pick<
  PublishedEntryRequestedMessage,
  "type" | "requestId" | "userId" | "spaceKey"
>;
export type EntryRequestEndedMessage = Simplify<
  Pick<
    PublishedEntryRequestEndedMessage,
    "type" | "requestId" | "userId" | "spaceKey" | "answeredBy"
  > & { outcome: EntryRequestOutcome }
>;
// Who locked it, or null when it ended on its own, is not kept: nothing shows it.
export type LockChangedMessage = Pick<
  PublishedLockChangedMessage,
  "type" | "spaceKey" | "locked"
>;
export type LockableSpacesMessage = Pick<
  PublishedLockableSpacesMessage,
  "type" | "spaceKeys"
>;
export type StaffActionMessage = Simplify<
  Pick<
    PublishedStaffActionMessage,
    "type" | "userId" | "by" | "spaceKey" | "until" | "player"
  > & { action: StaffAction }
>;
export type BroadcastCall = Pick<
  PublishedBroadcastCall,
  "url" | "room" | "token" | "canSpeak"
>;
export type BroadcastMessage = Simplify<
  Pick<PublishedBroadcastMessage, "type"> & { call: BroadcastCall | null }
>;
export type JoinedMessage = Simplify<
  Pick<PublishedJoinedMessage, "type"> & { player: Avatar }
>;
type Hearing = OrUnknown<PublishedCall["hearing"]>;
export type Call = Simplify<
  Pick<PublishedCall, "url" | "token" | "audibleRadius"> & { hearing: Hearing }
>;
export type CallMessage = Simplify<
  Pick<PublishedCallMessage, "type"> & { call: Call | null }
>;

// Frames no feature reads yet. Known, so they are not logged as skipped;
// stripped to their type, so nothing unread travels on.
type UnreadType = Extract<
  PublishedServerMessage["type"],
  | "desksChanged"
  | "mapChanged"
  | "watching"
  | "notification"
  | "positionCorrected"
>;
type UnreadMessage = { [Type in UnreadType]: { type: Type } }[UnreadType];

export type ServerMessage =
  | WelcomeMessage
  | PongMessage
  | SnapshotMessage
  | JoinedMessage
  | AppearanceMessage
  | LeftMessage
  | ReplacedMessage
  | MovedMessage
  | MoveResultMessage
  | ErrorMessage
  | NearbyMessage
  | StatusChangedMessage
  | SpaceChangedMessage
  | SpacesMessage
  | CallMessage
  | SaidMessage
  | EntryRequestedMessage
  | EntryRequestEndedMessage
  | LockChangedMessage
  | LockableSpacesMessage
  | StaffActionMessage
  | BroadcastMessage
  | WalkingMessage
  | WalkEndedMessage
  | UnreadMessage;

function orUnknown<const Values extends readonly [string, ...string[]]>(
  values: Values,
) {
  return z.union([
    z.enum(values),
    z.string().transform(() => "unknown" as const),
  ]);
}

const tileSchema = z.int().min(0);

const appearanceShape = {
  displayName: z.string().nullable(),
  spriteKey: z.string().nullable(),
};

const directionSchema = z.toZod<Direction>()(
  z.enum(["up", "down", "left", "right"]),
);

const moveOutcomeSchema = z.toZod<MoveOutcome>()(orUnknown(MOVE_OUTCOMES));
const walkEndReasonSchema = z.toZod<WalkEndReason>()(
  orUnknown(WALK_END_REASONS),
);

const errorCodeSchema = z.toZod<ErrorCode>()(
  orUnknown(["UNAUTHORIZED", "BAD_MESSAGE", "NOT_ALLOWED"]),
);

const playerStatusSchema = z.toZod<PlayerStatus>()(
  orUnknown(["available", "busy", "away"]),
);

// An end time that cannot be read is no end time: the status still shows.
const statusUntilSchema = z.iso
  .datetime({ offset: true })
  .nullable()
  .catch(null);

const playerSchema = z.toZod<Player>()(
  z.object({
    userId: z.string(),
    x: tileSchema,
    y: tileSchema,
    facing: directionSchema,
  }),
);

const avatarSchema = z.toZod<Avatar>()(
  z.object({
    ...playerSchema.shape,
    ...appearanceShape,
    status: playerStatusSchema,
    statusUntil: statusUntilSchema,
    spaceKey: z.string(),
  }),
);

const spaceNameSchema = z.toZod<SpaceName>()(
  z.object({ spaceKey: z.string(), name: z.string() }),
);

const welcomeMessageSchema = z.toZod<WelcomeMessage>()(
  z.object({
    type: z.literal("welcome"),
    userId: z.string(),
    connectionId: z.string(),
    heartbeatSeconds: z.int().positive(),
    stepMs: z.int().positive(),
    tickMs: z.int().positive(),
    awayAfterSeconds: z.int().nonnegative(),
    ...appearanceShape,
  }),
);

const pongMessageSchema = z.toZod<PongMessage>()(
  z.object({ type: z.literal("pong") }),
);

const snapshotMessageSchema = z.toZod<SnapshotMessage>()(
  z.object({
    type: z.literal("snapshot"),
    map: z.object({
      id: z.string(),
      version: z.string(),
      width: z.int().positive(),
      height: z.int().positive(),
    }),
    players: z.array(avatarSchema),
    // A label must not fail the handshake: names fall back to space keys.
    spaces: z.array(spaceNameSchema).catch([]),
    // A lock list must not fail the handshake: nothing is locked, and
    // nothing can be, until world says otherwise.
    lockableSpaces: z.array(z.string()).optional().catch(undefined),
    lockedSpaces: z.array(z.string()).optional().catch(undefined),
  }),
);

const joinedMessageSchema = z.toZod<JoinedMessage>()(
  z.object({ type: z.literal("joined"), player: avatarSchema }),
);

const appearanceMessageSchema = z.toZod<AppearanceMessage>()(
  z.object({
    type: z.literal("appearance"),
    userId: z.string(),
    ...appearanceShape,
  }),
);

const leftMessageSchema = z.toZod<LeftMessage>()(
  z.object({ type: z.literal("left"), userId: z.string() }),
);

const replacedMessageSchema = z.toZod<ReplacedMessage>()(
  z.object({ type: z.literal("replaced") }),
);

const movedMessageSchema = z.toZod<MovedMessage>()(
  z.object({ type: z.literal("moved"), players: z.array(playerSchema) }),
);

const moveResultMessageSchema = z.toZod<MoveResultMessage>()(
  z.object({
    type: z.literal("moveResult"),
    seq: z.int(),
    outcome: moveOutcomeSchema,
    player: playerSchema,
  }),
);

const walkingMessageSchema = z.toZod<WalkingMessage>()(
  z.object({ type: z.literal("walking"), player: playerSchema }),
);

const walkEndedMessageSchema = z.toZod<WalkEndedMessage>()(
  z.object({
    type: z.literal("walkEnded"),
    reason: walkEndReasonSchema,
    player: playerSchema,
    spaceKey: z.string().nullable(),
  }),
);

const errorMessageSchema = z.toZod<ErrorMessage>()(
  z.object({
    type: z.literal("error"),
    code: errorCodeSchema,
    message: z.string(),
  }),
);

const nearbyMessageSchema = z.toZod<NearbyMessage>()(
  z.object({ type: z.literal("nearby"), userIds: z.array(z.string()) }),
);

const statusChangedMessageSchema = z.toZod<StatusChangedMessage>()(
  z.object({
    type: z.literal("statusChanged"),
    userId: z.string(),
    status: playerStatusSchema,
    until: statusUntilSchema,
  }),
);

const spaceChangedMessageSchema = z.toZod<SpaceChangedMessage>()(
  z.object({
    type: z.literal("spaceChanged"),
    userId: z.string(),
    spaceKey: z.string(),
  }),
);

const spacesMessageSchema = z.toZod<SpacesMessage>()(
  z.object({ type: z.literal("spaces"), spaces: z.array(spaceNameSchema) }),
);

const callSchema = z.toZod<Call>()(
  z.object({
    url: z.string().min(1),
    token: z.string().min(1),
    hearing: orUnknown(["room", "proximity"]),
    audibleRadius: z.number().nonnegative(),
  }),
);

const callMessageSchema = z.toZod<CallMessage>()(
  z.object({ type: z.literal("call"), call: callSchema.nullable() }),
);

const entryRequestOutcomeSchema = z.toZod<EntryRequestOutcome>()(
  orUnknown([
    "admitted",
    "declined",
    "withdrawn",
    "walked_away",
    "nobody_inside",
    "not_needed",
    "cancelled",
  ]),
);

const saidMessageSchema = z.toZod<SaidMessage>()(
  z.object({
    type: z.literal("said"),
    id: z.string(),
    userId: z.string(),
    spaceKey: z.string(),
    text: z.string(),
    at: z.string(),
  }),
);

const entryRequestedMessageSchema = z.toZod<EntryRequestedMessage>()(
  z.object({
    type: z.literal("entryRequested"),
    requestId: z.string(),
    userId: z.string(),
    spaceKey: z.string(),
  }),
);

const entryRequestEndedMessageSchema = z.toZod<EntryRequestEndedMessage>()(
  z.object({
    type: z.literal("entryRequestEnded"),
    requestId: z.string(),
    userId: z.string(),
    spaceKey: z.string(),
    outcome: entryRequestOutcomeSchema,
    answeredBy: z.string().nullable(),
  }),
);

const lockChangedMessageSchema = z.toZod<LockChangedMessage>()(
  z.object({
    type: z.literal("lockChanged"),
    spaceKey: z.string(),
    locked: z.boolean(),
  }),
);

const lockableSpacesMessageSchema = z.toZod<LockableSpacesMessage>()(
  z.object({
    type: z.literal("lockableSpaces"),
    spaceKeys: z.array(z.string()),
  }),
);

const staffActionMessageSchema = z.toZod<StaffActionMessage>()(
  z.object({
    type: z.literal("staffAction"),
    action: orUnknown(["muted", "removed"]),
    userId: z.string(),
    by: z.string(),
    spaceKey: z.string(),
    until: z.string().nullable(),
    player: playerSchema.nullable(),
  }),
);

const broadcastCallSchema = z.toZod<BroadcastCall>()(
  z.object({
    url: z.string(),
    room: z.string(),
    token: z.string(),
    canSpeak: z.boolean(),
  }),
);

const broadcastMessageSchema = z.toZod<BroadcastMessage>()(
  z.object({
    type: z.literal("broadcast"),
    // Not caught: a call that cannot be read must not read as null, which
    // means leave the broadcast room. The frame is dropped and world sends
    // the next one within a heartbeat.
    call: broadcastCallSchema.nullable(),
  }),
);

function unreadMessageSchema<const Type extends UnreadType>(type: Type) {
  return z.object({ type: z.literal(type) });
}

const serverMessageSchema = z.toZod<ServerMessage>()(
  z.discriminatedUnion("type", [
    welcomeMessageSchema,
    pongMessageSchema,
    snapshotMessageSchema,
    joinedMessageSchema,
    appearanceMessageSchema,
    leftMessageSchema,
    replacedMessageSchema,
    movedMessageSchema,
    moveResultMessageSchema,
    errorMessageSchema,
    nearbyMessageSchema,
    statusChangedMessageSchema,
    spaceChangedMessageSchema,
    spacesMessageSchema,
    callMessageSchema,
    saidMessageSchema,
    entryRequestedMessageSchema,
    entryRequestEndedMessageSchema,
    lockChangedMessageSchema,
    lockableSpacesMessageSchema,
    staffActionMessageSchema,
    broadcastMessageSchema,
    unreadMessageSchema("desksChanged"),
    unreadMessageSchema("mapChanged"),
    unreadMessageSchema("watching"),
    unreadMessageSchema("notification"),
    unreadMessageSchema("positionCorrected"),
    walkingMessageSchema,
    walkEndedMessageSchema,
  ]),
);

export type ServerMessageResult =
  | { ok: true; message: ServerMessage }
  | { ok: false; reason: "unknown-type" }
  | { ok: false; reason: "invalid"; type?: ServerMessage["type"] };

const frameTypeSchema = z.object({ type: z.string() });

function isServerMessageType(type: string): type is ServerMessage["type"] {
  return serverMessageSchema.options.some(
    (option) => option.shape.type.value === type,
  );
}

// Unknown types are skipped, but a known frame that fails to parse is a
// fault: a corrupted welcome or snapshot leaves the client waiting forever.
export function parseServerMessage(text: string): ServerMessageResult {
  const frame = parseJson(z.unknown(), text);
  const message = serverMessageSchema.safeParse(frame).data;

  if (message) {
    return { ok: true, message };
  }

  const type = frameTypeSchema.safeParse(frame).data?.type;

  if (type === undefined) {
    return { ok: false, reason: "invalid" };
  }

  return isServerMessageType(type)
    ? { ok: false, reason: "invalid", type }
    : { ok: false, reason: "unknown-type" };
}
