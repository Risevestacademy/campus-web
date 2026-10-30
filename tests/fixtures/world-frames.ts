import type { ServerMessage as WorldFrame } from "@/core/realtime/generated/world-protocol";

type ServerFrames = {
  [Type in WorldFrame["type"]]: Extract<WorldFrame, { type: Type }>;
};

const ADA = "11111111-1111-4111-8111-111111111111";
const GRACE = "22222222-2222-4222-8222-222222222222";

// Shapes from world's protocol.schema.json, one frame per server message, as
// world sends them: the parser keeps only what the client reads.
export const serverFrames: ServerFrames = {
  welcome: {
    type: "welcome",
    userId: ADA,
    connectionId: "c0nn3ct10n",
    heartbeatSeconds: 30,
    stepMs: 100,
    tickMs: 50,
    awayAfterSeconds: 300,
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
        status: "available",
        spaceKey: "_default",
      },
    ],
    lockableSpaces: ["library"],
    lockedSpaces: [],
    spaces: [
      { spaceKey: "_default", name: "_default" },
      { spaceKey: "library", name: "Library" },
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
      status: "away",
      spaceKey: "_default",
    },
  },
  appearance: {
    type: "appearance",
    userId: GRACE,
    displayName: "Grace",
    spriteKey: "placeholder-2",
  },
  left: { type: "left", userId: GRACE },
  statusChanged: { type: "statusChanged", userId: GRACE, status: "busy" },
  spaceChanged: { type: "spaceChanged", userId: GRACE, spaceKey: "library" },
  call: {
    type: "call",
    call: {
      url: "wss://media.example.test",
      room: "cohort-1:library",
      token: "media-token",
      hearing: "proximity",
      audibleRadius: 6,
      subscribeRadius: 8,
    },
  },
  broadcast: {
    type: "broadcast",
    call: {
      url: "wss://media.example.test",
      room: "cohort-1:broadcast",
      token: "broadcast-token",
      canSpeak: false,
    },
  },
  nearby: { type: "nearby", userIds: [GRACE] },
  lockChanged: {
    type: "lockChanged",
    spaceKey: "library",
    locked: true,
    userId: GRACE,
  },
  lockableSpaces: { type: "lockableSpaces", spaceKeys: ["library"] },
  spaces: {
    type: "spaces",
    spaces: [
      { spaceKey: "_default", name: "_default" },
      { spaceKey: "library", name: "Reading Room" },
    ],
  },
  entryRequested: {
    type: "entryRequested",
    requestId: "r3qu35t",
    userId: GRACE,
    spaceKey: "library",
  },
  entryRequestEnded: {
    type: "entryRequestEnded",
    requestId: "r3qu35t",
    userId: GRACE,
    spaceKey: "library",
    outcome: "admitted",
    answeredBy: ADA,
  },
  said: {
    type: "said",
    id: "l1n3",
    userId: GRACE,
    spaceKey: "library",
    text: "Hello",
    at: "2026-10-30T09:00:00.000Z",
  },
  staffAction: {
    type: "staffAction",
    action: "removed",
    userId: GRACE,
    by: ADA,
    spaceKey: "library",
    until: "2026-10-30T09:01:30.000Z",
    player: { userId: GRACE, x: 3, y: 7, facing: "down" },
  },
  walking: {
    type: "walking",
    userId: GRACE,
    player: { userId: ADA, x: 4, y: 6, facing: "up" },
  },
  walkEnded: {
    type: "walkEnded",
    userId: GRACE,
    reason: "refused",
    player: { userId: ADA, x: 4, y: 6, facing: "up" },
    spaceKey: "library",
    mayAsk: true,
  },
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
