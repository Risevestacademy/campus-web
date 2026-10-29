import type { Avatar, ServerMessage } from "@/core/realtime";

const MAP = { id: "campus", version: "v1", width: 60, height: 40 };

export function avatar(userId: string, overrides: Partial<Avatar> = {}) {
  return {
    userId,
    x: 1,
    y: 1,
    facing: "down",
    displayName: userId,
    spriteKey: null,
    status: "available",
    spaceKey: "_default",
    ...overrides,
  } satisfies Avatar;
}

export function welcome(userId: string): ServerMessage {
  return {
    type: "welcome",
    userId,
    connectionId: "connection-1",
    heartbeatSeconds: 30,
    stepMs: 100,
    tickMs: 50,
    displayName: null,
    spriteKey: null,
  };
}

export function snapshot(...players: Avatar[]): ServerMessage {
  return { type: "snapshot", map: MAP, players };
}
