import type { ClientMessage, MoveOutcome } from "./index";

const ping: ClientMessage = { type: "ping" };
const move: ClientMessage = { type: "move", direction: "up", seq: 0 };

void ping;
void move;

// @ts-expect-error The world protocol publishes no teleport message.
const teleport: ClientMessage = { type: "teleport", x: 4, y: 7 };

// @ts-expect-error A move must carry the seq its moveResult echoes back.
const unnumberedMove: ClientMessage = { type: "move", direction: "up" };

// @ts-expect-error A move names a direction, never a destination tile.
const moveToTile: ClientMessage = { type: "move", x: 4, y: 7, seq: 1 };

void teleport;
void unnumberedMove;
void moveToTile;

// @ts-expect-error An outcome is one the protocol defines, or "unknown".
const inventedOutcome: MoveOutcome = "teleported";

void inventedOutcome;
