import type {
  LocalTrackPublication,
  Participant,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  Track,
  TrackPublication,
} from "livekit-client";

import { parseParticipantId } from "../../schemas/livekit-participant.schema";
import {
  type LivekitClient,
  loadLivekitClient,
} from "../livekit/livekit-client";
import {
  type CaptureSource,
  localChangeSource,
  type LocalPublicationChange,
  type RemoteMediaPublication,
  type VideoLayer,
} from "../media-session/contracts";
import {
  CONNECTION_QUALITIES,
  type ConnectionQuality,
  type MeetingAudience,
  type MeetingRoomConnection,
  type MeetingRoomEvents,
  type MeetingRoomTransport,
  RoomAccessDeniedError,
} from "./contracts";

export type LivekitRoomModule = Pick<
  LivekitClient,
  | "ConnectionError"
  | "ConnectionErrorReason"
  | "Room"
  | "RoomEvent"
  | "Track"
  | "VideoQuality"
>;

const CONNECT_OPTIONS = { autoSubscribe: false, maxRetries: 3 };

// Publishers stop encoding the camera layers nobody subscribes to.
const ROOM_OPTIONS = { dynacast: true };

function connectionQualityOf(quality: string): ConnectionQuality {
  return CONNECTION_QUALITIES.find((known) => known === quality) ?? "unknown";
}

type TrackOwner = Readonly<{ participantId: string; source: CaptureSource }>;

function remotePublicationOf(
  { participantId, source }: TrackOwner,
  track: RemoteTrack,
  publication: RemoteTrackPublication,
): RemoteMediaPublication {
  return {
    enabled: !publication.isMuted,
    origin: "remote",
    participantId,
    publicationId: publication.trackSid,
    source,
    stream: track.mediaStream ?? new MediaStream([track.mediaStreamTrack]),
    track: track.mediaStreamTrack,
  };
}

// Publishes copies: LiveKit may stop a track it fails to publish, and the
// member's own track must outlive the room. Changes run in order, and any
// still queued at close never clone.
function localTrackPublisher(room: Room, source: Track.Source) {
  const copies = new Set<MediaStreamTrack>();
  let published:
    | Readonly<{ copy: MediaStreamTrack; publication: LocalTrackPublication }>
    | undefined;
  let pending = Promise.resolve();
  let closed = false;

  function copyOf(track: MediaStreamTrack) {
    const copy = track.clone();
    copies.add(copy);
    return copy;
  }

  function stopCopy(copy: MediaStreamTrack) {
    copy.stop();
    copies.delete(copy);
  }

  // A copy LiveKit never took would run until close().
  async function withCopy(
    track: MediaStreamTrack,
    handOver: (copy: MediaStreamTrack) => Promise<void>,
  ) {
    const copy = copyOf(track);
    try {
      await handOver(copy);
    } catch (error) {
      stopCopy(copy);
      throw error;
    }
  }

  function publish(track: MediaStreamTrack) {
    return withCopy(track, async (copy) => {
      const publication = await room.localParticipant.publishTrack(copy, {
        source,
      });
      published = { copy, publication };
    });
  }

  function replace(track: MediaStreamTrack) {
    const current = published;
    const localTrack = current?.publication.track;
    if (!current || !localTrack) return publish(track);
    return withCopy(track, async (copy) => {
      await localTrack.replaceTrack(copy, true);
      stopCopy(current.copy);
      published = { ...current, copy };
    });
  }

  async function unpublish() {
    if (!published) return;
    const { copy } = published;
    published = undefined;
    await room.localParticipant.unpublishTrack(copy, false);
    stopCopy(copy);
  }

  function apply(change: LocalPublicationChange) {
    if (closed) return;
    if (change.type === "added") return publish(change.publication.track);
    if (change.type === "replaced") return replace(change.publication.track);
    return unpublish();
  }

  return {
    handle(change: LocalPublicationChange) {
      const applied = pending.then(() => apply(change));
      pending = applied.catch(() => undefined);
      return applied;
    },
    close() {
      closed = true;
      for (const copy of copies) stopCopy(copy);
    },
  };
}

// LiveKit lets anyone in the room subscribe until told otherwise, and keeps
// the last grant across its own reconnects.
function audienceGrant(room: Room) {
  let granted: string | undefined;

  function identitiesOf(participantIds: ReadonlySet<string>) {
    return [...room.remoteParticipants.values()]
      .map(({ identity }) => identity)
      .filter((identity) => {
        const participantId = parseParticipantId(identity);
        return participantId && participantIds.has(participantId);
      })
      .toSorted();
  }

  return function grant(participantIds: ReadonlySet<string>) {
    const identities = identitiesOf(participantIds);
    const key = identities.join("\n");
    if (key === granted) return;
    granted = key;
    room.localParticipant.setTrackSubscriptionPermissions(
      false,
      identities.map((participantIdentity) => ({
        participantIdentity,
        allowAll: true,
      })),
    );
  };
}

function connectRoom(
  livekit: LivekitRoomModule,
  room: Room,
  events: MeetingRoomEvents,
  now: () => number,
) {
  const { RoomEvent, Track, VideoQuality } = livekit;
  const VIDEO_QUALITY: Readonly<Record<VideoLayer, number>> = {
    low: VideoQuality.LOW,
    medium: VideoQuality.MEDIUM,
    high: VideoQuality.HIGH,
  };
  let audience: MeetingAudience = {
    participantIds: new Set(),
    video: new Map(),
  };
  let heardRemoteAudio = false;
  let sawRemoteVideo = false;
  let leaving = false;
  const cameraAskedAt = new Map<string, number>();
  const grant = audienceGrant(room);
  // Per publication, not trackSid: a full reconnect rebuilds publications
  // under their old ids, and each new one starts on the high layer.
  const requestedLayers = new WeakMap<RemoteTrackPublication, VideoLayer>();
  const handedOver = new Set<string>();
  const publishers: Readonly<
    Record<CaptureSource, ReturnType<typeof localTrackPublisher>>
  > = {
    camera: localTrackPublisher(room, Track.Source.Camera),
    microphone: localTrackPublisher(room, Track.Source.Microphone),
  };

  async function handleLocalPublicationChange(change: LocalPublicationChange) {
    const source = localChangeSource(change);
    if (source !== "screen") await publishers[source].handle(change);
  }

  function grantAudience() {
    grant(audience.participantIds);
  }

  function captureSourceOf({ source }: RemoteTrackPublication) {
    if (source === Track.Source.Microphone) return "microphone";
    if (source === Track.Source.Camera) return "camera";
    return undefined;
  }

  function ownerOf(
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ): TrackOwner | undefined {
    const source = captureSourceOf(publication);
    const participantId = source && parseParticipantId(participant.identity);
    return participantId && source ? { participantId, source } : undefined;
  }

  function isWanted({ participantId, source }: TrackOwner) {
    return source === "microphone"
      ? audience.participantIds.has(participantId)
      : audience.video.has(participantId);
  }

  function wantedOwnerOf(
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) {
    const owner = ownerOf(publication, participant);
    return owner && isWanted(owner) ? owner : undefined;
  }

  function requestLayer(
    publication: RemoteTrackPublication,
    layer: VideoLayer,
  ) {
    if (requestedLayers.get(publication) === layer) return;
    requestedLayers.set(publication, layer);
    publication.setVideoQuality(VIDEO_QUALITY[layer]);
  }

  function updateSubscription(
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) {
    const owner = wantedOwnerOf(publication, participant);
    const wanted = owner !== undefined;
    if (publication.isDesired !== wanted) {
      publication.setSubscribed(wanted);
      if (wanted && owner.source === "camera") {
        cameraAskedAt.set(publication.trackSid, now());
      }
    }
    const layer = owner && audience.video.get(owner.participantId);
    if (owner?.source === "camera" && layer) requestLayer(publication, layer);
  }

  function upsert(
    owner: TrackOwner,
    track: RemoteTrack,
    publication: RemoteTrackPublication,
  ) {
    handedOver.add(publication.trackSid);
    events.onRemotePublicationChange({
      publication: remotePublicationOf(owner, track, publication),
      type: "upserted",
    });
  }

  function forwardSubscribedTrack(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) {
    const owner = wantedOwnerOf(publication, participant);
    if (!owner) return;

    upsert(owner, track, publication);
    if (owner.source === "camera") reportFirstVideo(publication);
    else reportFirstAudio();
  }

  function reportFirstAudio() {
    if (heardRemoteAudio) return;
    heardRemoteAudio = true;
    events.onFirstRemoteAudio();
  }

  function reportFirstVideo({ trackSid }: RemoteTrackPublication) {
    const askedAt = cameraAskedAt.get(trackSid);
    if (sawRemoteVideo || askedAt === undefined) return;
    sawRemoteVideo = true;
    events.onFirstRemoteVideo({
      connectionQuality: connectionQualityOf(
        room.localParticipant.connectionQuality,
      ),
      waitedMs: now() - askedAt,
    });
  }

  // Mute events carry the base publication types; the room holds the remote
  // ones, and a member's own mutes are never in it.
  function forwardMute(
    { trackSid }: TrackPublication,
    { identity }: Participant,
  ) {
    const participant = room.remoteParticipants.get(identity);
    const publication = participant?.trackPublications.get(trackSid);
    const owner =
      participant && publication && wantedOwnerOf(publication, participant);
    if (owner && publication?.track)
      upsert(owner, publication.track, publication);
  }

  // Removal ignores the ask, since dropping someone unsubscribes them first,
  // but only a track handed over is ever taken back.
  function forwardRemovedTrack(
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) {
    const owner = ownerOf(publication, participant);
    if (!owner || !handedOver.delete(publication.trackSid)) return;

    events.onRemotePublicationChange({
      ...owner,
      publicationId: publication.trackSid,
      type: "removed",
    });
  }

  room
    .on(RoomEvent.ParticipantConnected, grantAudience)
    .on(RoomEvent.TrackPublished, updateSubscription)
    .on(RoomEvent.TrackSubscribed, forwardSubscribedTrack)
    .on(RoomEvent.TrackUnsubscribed, (_track, publication, participant) =>
      forwardRemovedTrack(publication, participant),
    )
    .on(RoomEvent.TrackUnpublished, forwardRemovedTrack)
    .on(RoomEvent.TrackMuted, forwardMute)
    .on(RoomEvent.TrackUnmuted, forwardMute)
    .on(RoomEvent.Disconnected, () => {
      if (!leaving) events.onDisconnected();
    });

  const connection: MeetingRoomConnection = {
    applyAudience(nextAudience) {
      audience = nextAudience;
      grantAudience();
      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.trackPublications.values()) {
          updateSubscription(publication, participant);
        }
      }
    },
    async disconnect() {
      leaving = true;
      await room.disconnect(true).catch(() => undefined);
      for (const publisher of Object.values(publishers)) publisher.close();
    },
    handleLocalPublicationChange,
  };
  return { connection, grantAudience };
}

function untilAborted<T>(work: Promise<T>, signal: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    work
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

function joinFailure(
  { ConnectionError, ConnectionErrorReason }: LivekitRoomModule,
  error: unknown,
) {
  return error instanceof ConnectionError &&
    error.reason === ConnectionErrorReason.NotAllowed
    ? new RoomAccessDeniedError(error.message)
    : error;
}

export function createLivekitMeetingRoomTransport(
  load: () => Promise<LivekitRoomModule> = loadLivekitClient,
  now: () => number = () => performance.now(),
): MeetingRoomTransport {
  return {
    async connect({ url, token }, events, signal) {
      const livekit = await untilAborted(load(), signal);
      const room = new livekit.Room(ROOM_OPTIONS);
      const { connection, grantAudience } = connectRoom(
        livekit,
        room,
        events,
        now,
      );

      try {
        await untilAborted(room.connect(url, token, CONNECT_OPTIONS), signal);
      } catch (error) {
        void connection.disconnect();
        throw joinFailure(livekit, error);
      }
      // A grant made before connecting is never sent.
      grantAudience();
      return connection;
    },
  };
}
