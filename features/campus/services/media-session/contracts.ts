export type CaptureSource = "camera" | "microphone";

export type PublicationSource = CaptureSource | "screen";

export type CaptureStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "disabled"
  | "denied"
  | "unavailable"
  | "failed";

export type DeviceDiscoveryStatus = "idle" | "loading" | "ready" | "failed";

export type DeviceAccessOutcome =
  | "granted"
  | "declined"
  | "failed"
  | "not_needed"
  | "unsupported"
  | "cancelled";

export type MediaSessionErrorCode =
  | "permission-denied"
  | "device-unavailable"
  | "device-unreadable"
  | "unsupported"
  | "unknown";

export type MediaDeviceOption = Readonly<{
  id: string;
  isDefault: boolean;
  label: string;
}>;

export type MediaDeviceCatalog = Readonly<{
  cameras: readonly MediaDeviceOption[];
  microphones: readonly MediaDeviceOption[];
  permissionRequired: Readonly<{
    cameras: boolean;
    microphones: boolean;
    speakers: boolean;
  }>;
  speakers: readonly MediaDeviceOption[];
}>;

export type DeviceCatalogSnapshot =
  | Readonly<{
      catalog: null;
      error: null;
      status: "idle";
    }>
  | Readonly<{
      catalog: MediaDeviceCatalog | null;
      error: null;
      status: "refreshing";
    }>
  | Readonly<{
      catalog: null;
      error: "enumeration-failed";
      status: "failed";
    }>
  | Readonly<{
      catalog: MediaDeviceCatalog;
      error: null;
      status: "ready";
    }>
  | Readonly<{
      catalog: MediaDeviceCatalog;
      error: "enumeration-failed";
      status: "stale";
    }>;

export type CaptureSourceState = Readonly<{
  desiredEnabled: boolean;
  devices: readonly MediaDeviceOption[];
  devicesRequirePermission: boolean;
  error: MediaSessionErrorCode | null;
  selectedDeviceId: string;
  status: CaptureStatus;
  track: MediaStreamTrack | null;
}>;

export type AudioOutputState = Readonly<{
  devices: readonly MediaDeviceOption[];
  error: MediaSessionErrorCode | null;
  selectedDeviceId: string;
  status: "idle" | "ready" | "unsupported" | "failed";
  supportsSelection: boolean;
}>;

type BaseMediaPublication = Readonly<{
  enabled: boolean;
  publicationId: string;
  source: PublicationSource;
  stream: MediaStream;
  track: MediaStreamTrack;
}>;

export type LocalMediaPublication = BaseMediaPublication &
  Readonly<{ origin: "local" }>;

export type RemoteMediaPublication = BaseMediaPublication &
  Readonly<{
    origin: "remote";
    participantId: string;
  }>;

export type ParticipantPublications = Readonly<
  Partial<Record<PublicationSource, RemoteMediaPublication>>
>;

export type RemotePublicationRegistry = Readonly<
  Record<string, ParticipantPublications>
>;

export type CallAudioStatus =
  "idle" | "connecting" | "connected" | "unavailable";

export type RemoteAudioGains = Readonly<Record<string, number>>;

export type MediaPublication = LocalMediaPublication | RemoteMediaPublication;

export type VideoSource = Exclude<PublicationSource, "microphone">;

// How much of a remote video a tile needs: a thumbnail, a grid cell, or the
// focused tile.
export type VideoLayer = "low" | "medium" | "high";

// The remote videos on screen, by source and participant id.
export type VideoDemand = Readonly<
  Record<VideoSource, ReadonlyMap<string, VideoLayer>>
>;

export const NO_VIDEO_DEMAND: VideoDemand = {
  camera: new Map(),
  screen: new Map(),
};

export type ScreenShareEndReason =
  | "stopped"
  | "browser_stopped"
  | "meeting_ended"
  | "room_closed"
  | "publish_failed"
  | "session_ended";

export type ScreenShareState = Readonly<
  | {
      // How the last share went; cleared when the member shares again.
      outcome:
        ScreenShareEndReason | "capture_blocked" | "capture_failed" | null;
      status: "idle" | "requesting";
    }
  | { outcome: null; publication: LocalMediaPublication; status: "sharing" }
>;

export type LocalPublicationChange =
  | Readonly<{
      publication: LocalMediaPublication;
      type: "added";
    }>
  | Readonly<{
      previousTrack: MediaStreamTrack;
      publication: LocalMediaPublication;
      type: "replaced";
    }>
  | Readonly<{
      endReason?: ScreenShareEndReason;
      previousTrack: MediaStreamTrack;
      publicationId: string;
      source: PublicationSource;
      type: "removed";
    }>;

export function localChangeSource(
  change: LocalPublicationChange,
): PublicationSource {
  return change.type === "removed" ? change.source : change.publication.source;
}

export type RemotePublicationChange =
  | Readonly<{
      publication: RemoteMediaPublication;
      type: "upserted";
    }>
  | Readonly<{
      participantId: string;
      publicationId: string;
      source: PublicationSource;
      type: "removed";
    }>;

// A microphone in the cohort's broadcast room, with the name World signed into
// its speaker's token: they may not be in this cohort's presence.
export type BroadcastPublication = RemoteMediaPublication &
  Readonly<{ speakerName: string | null }>;

export type BroadcastPublicationChange =
  | Readonly<{ publication: BroadcastPublication; type: "upserted" }>
  | Extract<RemotePublicationChange, { type: "removed" }>;

// The broadcast's microphones by participant id.
export type BroadcastPublications = Readonly<
  Record<string, BroadcastPublication>
>;

export type MeetingMediaTransportCallbacks = Readonly<{
  // A microphone in the cohort's broadcast room: played over everything else,
  // never muted, and never part of the meeting.
  onBroadcastPublicationChange: (change: BroadcastPublicationChange) => void;
  // Whether the room refused the member's latest camera change; the call
  // itself carries on either way.
  onCameraPublishOutcome: (failed: boolean) => void;
  onRemoteAudioGainsChange: (gains: RemoteAudioGains) => void;
  onRemotePublicationChange: (change: RemotePublicationChange) => void;
  // Who in the roster is sharing a screen, subscribed or not, so a tile can
  // mount and ask for it.
  onRemoteScreenSharesChange: (participantIds: ReadonlySet<string>) => void;
  // The call can no longer carry the member's screen. Safe to report when
  // nothing is being shared.
  onScreenShareEnded: (reason: ScreenShareEndReason) => void;
  onStatusChange: (status: CallAudioStatus) => void;
}>;

export interface MeetingMediaTransport {
  // Called once per Presence Session, after Admission. The returned function
  // disconnects and must release peer connections; never rely on page unload.
  connect(callbacks: MeetingMediaTransportCallbacks): () => void;
  // Called only while connected.
  handleLocalPublicationChange(change: LocalPublicationChange): void;
  // The member asked to try the call again after it became unavailable.
  // Called only while connected.
  retry(): void;
  // Called whenever the tiles on screen change, connected or not; the latest
  // demand wins.
  setVideoDemand(demand: VideoDemand): void;
}
