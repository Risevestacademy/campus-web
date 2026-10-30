import { presenceFor } from "@/core/presence";
import type { Avatar, ServerMessage } from "@/core/realtime";

import { serverFrames } from "./world-frames";

function avatar(userId: string, displayName: string | null): Avatar {
  return {
    userId,
    x: 1,
    y: 1,
    facing: "down",
    displayName,
    spriteKey: null,
    status: "available",
    spaceKey: "_default",
  };
}

export const ADA = avatar(serverFrames.welcome.userId, "Ada Lovelace");
export const GRACE = avatar(serverFrames.joined.player.userId, "Grace Hopper");
export const LIN = avatar("33333333-3333-4333-8333-333333333333", "Lin Wei");
export const MAYA = avatar(
  "44444444-4444-4444-8444-444444444444",
  "Maya Angelou",
);

export function nearbyFrame(...people: Avatar[]): ServerMessage {
  return { type: "nearby", userIds: people.map(({ userId }) => userId) };
}

export function joinedFrame(player: Avatar): ServerMessage {
  return { type: "joined", player };
}

export function seedPresence(cohortId: string, ...near: Avatar[]) {
  const presence = presenceFor(cohortId).getState();
  presence.clear();
  presence.apply(serverFrames.welcome);
  presence.apply({
    type: "snapshot",
    map: serverFrames.snapshot.map,
    players: [ADA, GRACE, LIN, MAYA],
  });
  if (near.length > 0) presence.apply(nearbyFrame(...near));
}

export function applyFrame(cohortId: string, frame: ServerMessage) {
  presenceFor(cohortId).getState().apply(frame);
}

export function clearPresence(cohortId: string) {
  presenceFor(cohortId).getState().clear();
}
