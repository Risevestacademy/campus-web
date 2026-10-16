import { z } from "zod";

import type { Simplify } from "@/core/api/schemas";
import { parseJson } from "@/shared/lib/parse-json";

import type {
  AppearanceMessage,
  Avatar,
  Direction,
  ErrorMessage as PublishedErrorMessage,
  JoinedMessage,
  LeftMessage,
  MovedMessage,
  MoveOutcome as PublishedMoveOutcome,
  MoveResultMessage as PublishedMoveResultMessage,
  Player,
  PongMessage,
  ReplacedMessage,
  ServerMessage as PublishedServerMessage,
  SnapshotMessage,
  WelcomeMessage,
} from "./generated/world-protocol";

// A value world added after the last `pnpm world:types` reads as "unknown",
// so the frame still arrives and the move it answers still resolves.
type OrUnknown<Value extends string> = Value | "unknown";

export type MoveOutcome = OrUnknown<PublishedMoveOutcome>;
export type ErrorCode = OrUnknown<PublishedErrorMessage["code"]>;
export type MoveResultMessage = Simplify<
  Omit<PublishedMoveResultMessage, "outcome"> & { outcome: MoveOutcome }
>;
export type ErrorMessage = Simplify<
  Omit<PublishedErrorMessage, "code"> & { code: ErrorCode }
>;
export type ServerMessage =
  | Exclude<PublishedServerMessage, { type: "moveResult" | "error" }>
  | MoveResultMessage
  | ErrorMessage;

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

const moveOutcomeSchema = z.toZod<MoveOutcome>()(
  orUnknown(["moved", "blocked", "too_fast"]),
);

const errorCodeSchema = z.toZod<ErrorCode>()(
  orUnknown(["UNAUTHORIZED", "BAD_MESSAGE"]),
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
  z.object({ ...playerSchema.shape, ...appearanceShape }),
);

const welcomeMessageSchema = z.toZod<WelcomeMessage>()(
  z.object({
    type: z.literal("welcome"),
    userId: z.string(),
    connectionId: z.string(),
    heartbeatSeconds: z.int(),
    stepMs: z.int(),
    tickMs: z.int(),
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
      width: z.int(),
      height: z.int(),
    }),
    players: z.array(avatarSchema),
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
