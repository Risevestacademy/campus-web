import type { ServerMessage } from "@/core/realtime";

type ServerFrames = {
  [Type in ServerMessage["type"]]: Extract<ServerMessage, { type: Type }>;
};

const ADA = "11111111-1111-4111-8111-111111111111";
const GRACE = "22222222-2222-4222-8222-222222222222";

// Shapes from world's protocol.schema.json, one frame per server message.
export const serverFrames: ServerFrames = {
  welcome: {
    type: "welcome",
    userId: ADA,
    connectionId: "c0nn3ct10n",
    heartbeatSeconds: 30,
    stepMs: 100,
    tickMs: 50,
    displayName: "Ada",
    spriteKey: null,
  },
  pong: { type: "pong" },
  snapshot: {
    type: "snapshot",
    map: { id: "campus", version: "d686dbad05445e71", width: 60, height: 40 },
    players: [
      {
        userId: ADA,
        x: 4,
        y: 7,
        facing: "down",
        displayName: "Ada",
        spriteKey: "placeholder-1",
      },
    ],
  },
  joined: {
    type: "joined",
    player: {
      userId: GRACE,
      x: 0,
      y: 0,
      facing: "right",
      displayName: null,
      spriteKey: null,
    },
  },
  appearance: {
    type: "appearance",
    userId: GRACE,
    displayName: "Grace",
    spriteKey: "placeholder-2",
  },
  left: { type: "left", userId: GRACE },
  replaced: { type: "replaced" },
  moved: {
    type: "moved",
    players: [{ userId: GRACE, x: 1, y: 0, facing: "right" }],
  },
  moveResult: {
    type: "moveResult",
    seq: 12,
    outcome: "blocked",
    player: { userId: ADA, x: 4, y: 7, facing: "up" },
  },
  error: { type: "error", code: "BAD_MESSAGE", message: "Unknown type." },
};
