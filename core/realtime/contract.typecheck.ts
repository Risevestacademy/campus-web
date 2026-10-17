import { WORLD_CLOSE_CODES, WORLD_CLOSE_REASONS } from "./close-codes";
import type {
  CloseCode as WorldCloseCode,
  CloseReason as WorldCloseReason,
} from "./generated/world-protocol";
import type { ClientMessage } from "./index";

type Same<Left, Right> = [Left] extends [Right]
  ? [Right] extends [Left]
    ? true
    : false
  : false;

const worldCloseCodesAreComplete: Same<
  WorldCloseCode,
  (typeof WORLD_CLOSE_CODES)[number]
> = true;
const worldCloseReasonsAreComplete: Same<
  WorldCloseReason,
  (typeof WORLD_CLOSE_REASONS)[number]
> = true;

const ping: ClientMessage = { type: "ping" };
const move: ClientMessage = { type: "move", direction: "up", seq: 0 };

void ping;
void move;
void worldCloseCodesAreComplete;
void worldCloseReasonsAreComplete;

// @ts-expect-error The world protocol publishes no teleport message.
const teleport: ClientMessage = { type: "teleport", x: 4, y: 7 };

// @ts-expect-error A move must carry the seq its moveResult echoes back.
const unnumberedMove: ClientMessage = { type: "move", direction: "up" };

// @ts-expect-error A move names a direction, never a destination tile.
const moveToTile: ClientMessage = { type: "move", x: 4, y: 7, seq: 1 };

void teleport;
void unnumberedMove;
void moveToTile;
