import type * as Livekit from "livekit-client";

export type LivekitClient = typeof Livekit;

export function loadLivekitClient(): Promise<LivekitClient> {
  return import("livekit-client");
}
