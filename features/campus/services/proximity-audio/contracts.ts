import type { Presence } from "@/core/presence";
import type { ServerMessage } from "@/core/realtime";

import type {
  LocalPublicationChange,
  MeetingMediaTransport,
  RemotePublicationChange,
} from "../media-session/contracts";

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

export interface ProximityAudioSession extends MeetingMediaTransport {
  applyWorldMessage(message: ServerMessage, presence: Presence): void;
}
