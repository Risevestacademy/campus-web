import { z } from "zod";

import type { Simplify } from "@/core/api/schemas";
import { parseJson } from "@/shared/lib/parse-json";

import type {
  AppearanceMessage,
  Avatar as PublishedAvatar,
  Call as PublishedCall,
  CallMessage as PublishedCallMessage,
  Direction,
  ErrorMessage as PublishedErrorMessage,
  JoinedMessage as PublishedJoinedMessage,
  LeftMessage,
  MovedMessage,
  MoveOutcome as PublishedMoveOutcome,
  MoveResultMessage as PublishedMoveResultMessage,
  NearbyMessage,
  Player,
  PongMessage,
  ReplacedMessage,
  ServerMessage as PublishedServerMessage,
  SnapshotMessage as PublishedSnapshotMessage,
  SpaceChangedMessage,
  SpaceName,
  SpacesMessage,
  Status as PublishedStatus,
  StatusChangedMessage as PublishedStatusChangedMessage,
  WelcomeMessage as PublishedWelcomeMessage,
} from "./generated/world-protocol";
import { MOVE_OUTCOMES } from "./move-outcomes";

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
export type Avatar = Simplify<
  Pick<
    PublishedAvatar,
    keyof Player | "displayName" | "spriteKey" | "spaceKey"
  > & { status: PlayerStatus }
>;
export type StatusChangedMessage = Simplify<
  Pick<PublishedStatusChangedMessage, "type" | "userId"> & {
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
    | "displayName"
    | "spriteKey"
  >
>;
export type SnapshotMessage = Simplify<
  Pick<PublishedSnapshotMessage, "type" | "map" | "spaces"> & {
    players: Avatar[];
  }
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
  | "lockChanged"
  | "lockableSpaces"
  | "broadcast"
  | "said"
  | "entryRequested"
  | "entryRequestEnded"
  | "staffAction"
  | "walking"
  | "walkEnded"
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

const errorCodeSchema = z.toZod<ErrorCode>()(
  orUnknown(["UNAUTHORIZED", "BAD_MESSAGE", "NOT_ALLOWED"]),
);

const playerStatusSchema = z.toZod<PlayerStatus>()(
  orUnknown(["available", "busy", "away"]),
);

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
    spaces: z.array(spaceNameSchema),
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
    unreadMessageSchema("lockChanged"),
    unreadMessageSchema("lockableSpaces"),
    unreadMessageSchema("broadcast"),
    unreadMessageSchema("said"),
    unreadMessageSchema("entryRequested"),
    unreadMessageSchema("entryRequestEnded"),
    unreadMessageSchema("staffAction"),
    unreadMessageSchema("walking"),
    unreadMessageSchema("walkEnded"),
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
