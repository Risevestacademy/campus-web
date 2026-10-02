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

export type MediaPublication = LocalMediaPublication | RemoteMediaPublication;

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
      previousTrack: MediaStreamTrack;
      publicationId: string;
      source: PublicationSource;
      type: "removed";
    }>;

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

export interface MeetingMediaTransport {
  handleLocalPublicationChange(change: LocalPublicationChange): void;
  subscribeToRemotePublications(
    listener: (change: RemotePublicationChange) => void,
  ): () => void;
}
