import { type Mock, vi } from "vitest";

import type { LivekitRoomModule } from "../services/call-media/livekit-meeting-room-transport";
import type { LivekitModule } from "../services/connection-check/livekit-probe";
import {
  createTestMediaStream,
  createTestMediaTrack,
} from "./media-session-test-utils";

type FakeCheckStatus = "SUCCESS" | "SKIPPED" | "FAILED";

const CheckStatus = {
  IDLE: 0,
  RUNNING: 1,
  SKIPPED: 2,
  SUCCESS: 3,
  FAILED: 4,
} as const;

export type FakeTrack = MediaStreamTrack &
  Readonly<{ stop: Mock; copy: MediaStreamTrack & { stop: Mock } }>;

export function fakeTrack(kind: "audio" | "video"): FakeTrack {
  const copy = { kind, stop: vi.fn() };
  return {
    kind,
    stop: vi.fn(),
    clone: () => copy,
    copy,
  } as unknown as FakeTrack;
}

// Mirrors the slice of livekit-client the probe uses: a Checker's run()
// catches what perform() throws and reports FAILED, as the SDK's does.
export function fakeLivekit({
  websocket = "SUCCESS",
  webrtc = "SUCCESS",
  turn = "SUCCESS",
  packetsSent = 100,
  publishFails = false,
}: {
  websocket?: FakeCheckStatus;
  webrtc?: FakeCheckStatus;
  turn?: FakeCheckStatus;
  packetsSent?: number;
  publishFails?: boolean;
} = {}) {
  const constructed: { url: string; token: string }[] = [];
  const ran: string[] = [];
  const published: MediaStreamTrack[] = [];

  const room = {
    localParticipant: {
      async publishTrack(track: MediaStreamTrack) {
        if (publishFails) throw new Error("publish failed");
        published.push(track);
        const stats = new Map([["out", { type: "outbound-rtp", packetsSent }]]);
        return { track: { sender: { getStats: async () => stats } } };
      },
    },
  };

  abstract class Checker {
    status: number = CheckStatus.IDLE;

    constructor(
      protected url: string,
      protected token: string,
    ) {}

    abstract get description(): string;

    protected abstract perform(): Promise<void>;

    protected async connect() {
      return room;
    }

    async run() {
      try {
        await this.perform();
        this.status = CheckStatus.SUCCESS;
      } catch {
        this.status = CheckStatus.FAILED;
      }
      return {
        name: "",
        description: this.description,
        logs: [],
        status: this.status,
      };
    }
  }

  function info(name: string, status: FakeCheckStatus) {
    ran.push(name);
    return Promise.resolve({
      name,
      description: name,
      logs: [],
      status: CheckStatus[status],
    });
  }

  class ConnectionCheck {
    constructor(
      private url: string,
      private token: string,
    ) {
      constructed.push({ url, token });
    }

    checkWebsocket() {
      return info("websocket", websocket);
    }

    checkWebRTC() {
      return info("webrtc", webrtc);
    }

    checkTURN() {
      return info("turn", turn);
    }

    createAndRunCheck(Check: new (url: string, token: string) => Checker) {
      return new Check(this.url, this.token).run();
    }
  }

  return {
    module: {
      Checker,
      CheckStatus,
      ConnectionCheck,
    } as unknown as LivekitModule,
    constructed,
    ran,
    published,
  };
}

type Listener = (...arguments_: unknown[]) => void;

type FakeConnectOutcome = "resolve" | "reject" | "deny" | "hang";

const ConnectionErrorReason = { NotAllowed: 0, ServerUnreachable: 2 } as const;

// LiveKit rejects an expired or refused token with reason NotAllowed.
class ConnectionError extends Error {
  constructor(
    message: string,
    readonly reason: number,
  ) {
    super(message);
  }
}

const RoomEvent = {
  Disconnected: "disconnected",
  ParticipantConnected: "participantConnected",
  ParticipantDisconnected: "participantDisconnected",
  TrackMuted: "trackMuted",
  TrackPublished: "trackPublished",
  TrackSubscribed: "trackSubscribed",
  TrackUnmuted: "trackUnmuted",
  TrackUnpublished: "trackUnpublished",
  TrackUnsubscribed: "trackUnsubscribed",
} as const;

const Track = {
  Source: {
    Camera: "camera",
    Microphone: "microphone",
    ScreenShare: "screen_share",
    Unknown: "unknown",
  },
} as const;

const VideoQuality = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;

export type FakeTrackSource = (typeof Track.Source)[keyof typeof Track.Source];

type FakeRemoteTrack = Readonly<{
  mediaStream: MediaStream;
  mediaStreamTrack: MediaStreamTrack;
}>;

export type FakeRemotePublication = {
  isDesired: boolean;
  isMuted: boolean;
  readonly source: FakeTrackSource;
  track: FakeRemoteTrack | undefined;
  readonly trackSid: string;
  setSubscribed(subscribed: boolean): void;
  setVideoQuality(quality: number): void;
};

export type FakeRemoteParticipant = Readonly<{
  identity: string;
  trackPublications: Map<string, FakeRemotePublication>;
}>;

export type FakeLocalPublication = Readonly<{
  options: unknown;
  track: MediaStreamTrack;
  replaceTrack: Mock;
}>;

export type SubscriptionRecord = Readonly<{
  identity: string;
  source: FakeTrackSource;
  subscribed: boolean;
}>;

export type QualityRecord = Readonly<{
  identity: string;
  quality: keyof typeof VideoQuality;
}>;

// Who the member let subscribe to their tracks, as the SFU was told.
export type GrantRecord = Readonly<{
  allParticipantsAllowed: boolean;
  identities: readonly string[];
}>;

// Mirrors the slice of livekit-client's Room the call-media adapter uses.
// Subscribing never delivers a track by itself: tests call deliver(), as the
// SFU answers later and may not answer at all.
export function fakeLivekitRoom() {
  const rooms: FakeRoom[] = [];
  const subscriptions: SubscriptionRecord[] = [];
  const grants: GrantRecord[] = [];
  const qualities: QualityRecord[] = [];
  const timeline: string[] = [];
  const control: {
    connect: FakeConnectOutcome;
    alreadyInRoom: readonly (readonly [string, readonly FakeTrackSource[]])[];
  } = { alreadyInRoom: [], connect: "resolve" };

  function remotePublication(
    identity: string,
    source: FakeTrackSource,
  ): FakeRemotePublication {
    return {
      isDesired: false,
      isMuted: false,
      source,
      track: undefined,
      trackSid: `${identity}-${source}`,
      setSubscribed(subscribed) {
        this.isDesired = subscribed;
        subscriptions.push({ identity, source, subscribed });
      },
      setVideoQuality(quality) {
        const name = Object.entries(VideoQuality).find(
          ([, value]) => value === quality,
        )?.[0] as QualityRecord["quality"];
        qualities.push({ identity, quality: name });
      },
    };
  }

  function publicationOf(
    participant: FakeRemoteParticipant,
    source: FakeTrackSource,
  ) {
    const publication = participant.trackPublications.get(
      `${participant.identity}-${source}`,
    );
    if (!publication) {
      throw new Error(`${participant.identity} has no ${source} publication.`);
    }
    return publication;
  }

  class FakeRoom {
    readonly connectCalls: { url: string; token: string; options: unknown }[] =
      [];
    readonly disconnectCalls: (boolean | undefined)[] = [];
    readonly published: FakeLocalPublication[] = [];
    readonly unpublished: { track: MediaStreamTrack; stop?: boolean }[] = [];
    readonly grants: GrantRecord[] = [];
    readonly remoteParticipants = new Map<string, FakeRemoteParticipant>();
    disconnectFails = false;
    publishFails = false;
    private readonly listeners = new Map<string, Listener[]>();
    private publishing = Promise.resolve();

    readonly localParticipant = {
      publishTrack: async (track: MediaStreamTrack, options?: unknown) => {
        await this.publishing;
        if (this.publishFails) throw new Error("publish failed");
        const publication = { options, track, replaceTrack: vi.fn() };
        publication.replaceTrack.mockResolvedValue(publication);
        this.published.push(publication);
        return { track: publication };
      },
      unpublishTrack: async (track: MediaStreamTrack, stop?: boolean) => {
        this.unpublished.push({ track, stop });
        return undefined;
      },
      setTrackSubscriptionPermissions: (
        allParticipantsAllowed: boolean,
        permissions: readonly { participantIdentity?: string }[] = [],
      ) => {
        const grant = {
          allParticipantsAllowed,
          identities: permissions.map(
            ({ participantIdentity }) => participantIdentity ?? "",
          ),
        };
        this.grants.push(grant);
        grants.push(grant);
      },
    };

    constructor() {
      rooms.push(this);
      for (const [identity, sources] of control.alreadyInRoom) {
        this.join(identity, sources);
      }
    }

    private get index() {
      return rooms.indexOf(this);
    }

    // Publishes wait until the returned release runs, as on a slow network.
    holdPublishes() {
      let release = () => {};
      this.publishing = new Promise((resolve) => {
        release = resolve;
      });
      return release;
    }

    on(event: string, listener: Listener) {
      this.listeners.set(event, [
        ...(this.listeners.get(event) ?? []),
        listener,
      ]);
      return this;
    }

    emit(event: string, ...arguments_: unknown[]) {
      for (const listener of this.listeners.get(event) ?? [])
        listener(...arguments_);
    }

    connect(url: string, token: string, options?: unknown) {
      this.connectCalls.push({ url, token, options });
      timeline.push(`connect:${this.index}`);
      if (control.connect === "hang") return new Promise<void>(() => {});
      if (control.connect === "reject") {
        return Promise.reject(
          new ConnectionError(
            "server unreachable",
            ConnectionErrorReason.ServerUnreachable,
          ),
        );
      }
      if (control.connect === "deny") {
        return Promise.reject(
          new ConnectionError(
            "token expired",
            ConnectionErrorReason.NotAllowed,
          ),
        );
      }
      return Promise.resolve();
    }

    async disconnect(stopTracks?: boolean) {
      this.disconnectCalls.push(stopTracks);
      timeline.push(`disconnect:${this.index}`);
      this.emit(RoomEvent.Disconnected);
      if (this.disconnectFails) throw new Error("disconnect failed");
    }

    // Already in the room when this member joins: the SDK announces nobody.
    join(identity: string, sources: readonly FakeTrackSource[]) {
      const participant: FakeRemoteParticipant = {
        identity,
        trackPublications: new Map(
          sources.map((source) => {
            const publication = remotePublication(identity, source);
            return [publication.trackSid, publication];
          }),
        ),
      };
      this.remoteParticipants.set(identity, participant);
      return participant;
    }

    arrive(identity: string, sources: readonly FakeTrackSource[]) {
      const participant = this.join(identity, sources);
      this.emit(RoomEvent.ParticipantConnected, participant);
      for (const publication of participant.trackPublications.values()) {
        this.emit(RoomEvent.TrackPublished, publication, participant);
      }
      return participant;
    }

    deliver(participant: FakeRemoteParticipant, source: FakeTrackSource) {
      const publication = publicationOf(participant, source);
      const mediaStreamTrack = createTestMediaTrack(
        source === Track.Source.Camera ? "video" : "audio",
        publication.trackSid,
      );
      const track = {
        mediaStream: createTestMediaStream([mediaStreamTrack]),
        mediaStreamTrack,
      };
      publication.track = track;
      this.emit(RoomEvent.TrackSubscribed, track, publication, participant);
      return track;
    }

    mute(
      participant: FakeRemoteParticipant,
      source: FakeTrackSource,
      muted: boolean,
    ) {
      const publication = publicationOf(participant, source);
      publication.isMuted = muted;
      this.emit(
        muted ? RoomEvent.TrackMuted : RoomEvent.TrackUnmuted,
        publication,
        participant,
      );
    }

    unsubscribe(participant: FakeRemoteParticipant, source: FakeTrackSource) {
      const publication = publicationOf(participant, source);
      this.emit(RoomEvent.TrackUnsubscribed, {}, publication, participant);
    }

    unpublish(participant: FakeRemoteParticipant, source: FakeTrackSource) {
      const publication = publicationOf(participant, source);
      participant.trackPublications.delete(publication.trackSid);
      this.emit(RoomEvent.TrackUnpublished, publication, participant);
    }

    // The SDK unpublishes every track before it announces the leave, and on
    // a full reconnect it does this for every participant.
    leave(participant: FakeRemoteParticipant) {
      this.remoteParticipants.delete(participant.identity);
      for (const publication of [...participant.trackPublications.values()]) {
        this.unpublish(participant, publication.source);
      }
      this.emit(RoomEvent.ParticipantDisconnected, participant);
    }
  }

  function roomAt(index: number) {
    const room = rooms[index];
    if (!room) throw new Error(`No room was built at ${index}.`);
    return room;
  }

  return {
    control,
    grants,
    module: {
      ConnectionError,
      ConnectionErrorReason,
      Room: FakeRoom,
      RoomEvent,
      Track,
      VideoQuality,
    } as unknown as LivekitRoomModule,
    qualities,
    roomAt,
    rooms,
    subscriptions,
    timeline,
  };
}

export type FakeLivekitRoom = ReturnType<typeof fakeLivekitRoom>;
export type FakeRoom = ReturnType<FakeLivekitRoom["roomAt"]>;
