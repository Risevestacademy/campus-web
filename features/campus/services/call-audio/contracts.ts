import type { Presence } from "@/core/presence";
import type { ServerMessage } from "@/core/realtime";

import type {
  LocalPublicationChange,
  MeetingMediaTransport,
  RemotePublicationChange,
} from "../media-session/contracts";

// The room refused the grant, most often because its token expired: only a
// fresh call from World can join it.
export class RoomAccessDeniedError extends Error {
  override name = "RoomAccessDeniedError";
}

export type MeetingRoomEvents = Readonly<{
  onDisconnected: () => void;
  onFirstRemoteAudio: () => void;
  onRemotePublicationChange: (change: RemotePublicationChange) => void;
}>;

export interface MeetingRoomConnection {
  // Safe to call more than once, including after onDisconnected: the session
  // always calls it to release local tracks, even when the room already dropped.
  disconnect(): Promise<void>;
  handleLocalPublicationChange(change: LocalPublicationChange): Promise<void>;
  setSubscribedParticipantIds(participantIds: ReadonlySet<string>): void;
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

export interface CallAudioSession extends MeetingMediaTransport {
  applyWorldMessage(message: ServerMessage, presence: Presence): void;
  // Presence that changed without a frame, like a World close clearing it.
  applyPresence(presence: Presence): void;
}
