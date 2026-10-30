import type { Presence } from "@/core/presence";
import type { ServerMessage } from "@/core/realtime";

import type {
  LocalPublicationChange,
  MeetingMediaTransport,
  RemotePublicationChange,
  VideoDemand,
} from "../media-session/contracts";

// The room refused the grant, most often because its token expired: only a
// fresh call from World can join it.
export class RoomAccessDeniedError extends Error {
  override name = "RoomAccessDeniedError";
}

export const CONNECTION_QUALITIES = [
  "excellent",
  "good",
  "poor",
  "lost",
  "unknown",
] as const;

export type ConnectionQuality = (typeof CONNECTION_QUALITIES)[number];

// How long the room's first remote camera took from being asked for, and the
// member's own link quality at that moment.
export type FirstRemoteVideo = Readonly<{
  connectionQuality: ConnectionQuality;
  waitedMs: number;
}>;

export type MeetingRoomEvents = Readonly<{
  onDisconnected: () => void;
  onFirstRemoteAudio: () => void;
  onFirstRemoteVideo: (firstVideo: FirstRemoteVideo) => void;
  onRemotePublicationChange: (change: RemotePublicationChange) => void;
}>;

// The members you meet: you hear them, and only they may receive your tracks.
// `video` holds the ones whose cameras are on screen.
export type MeetingAudience = Readonly<{
  participantIds: ReadonlySet<string>;
  video: VideoDemand;
}>;

export interface MeetingRoomConnection {
  // Safe to call more than once, including after onDisconnected: the session
  // always calls it to release local tracks, even when the room already dropped.
  applyAudience(audience: MeetingAudience): void;
  disconnect(): Promise<void>;
  handleLocalPublicationChange(change: LocalPublicationChange): Promise<void>;
}

export interface MeetingRoomTransport {
  // Must reject once `signal` aborts, and `disconnect` must always settle:
  // joins and disconnects run one at a time, so a step that never settles
  // blocks every later call.
  connect(
    access: Readonly<{ url: string; token: string }>,
    events: MeetingRoomEvents,
    signal: AbortSignal,
  ): Promise<MeetingRoomConnection>;
}

export interface CallMediaSession extends MeetingMediaTransport {
  applyWorldMessage(message: ServerMessage, presence: Presence): void;
  // Presence that changed without a frame, like a World close clearing it.
  applyPresence(presence: Presence): void;
}
