import type {
  Participant,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  TrackPublication,
} from "livekit-client";

import { parseParticipantId } from "../../schemas/livekit-participant.schema";
import {
  type LivekitClient,
  loadLivekitClient,
} from "../livekit/livekit-client";
import {
  localChangeSource,
  type LocalPublicationChange,
  NO_VIDEO_DEMAND,
  type PublicationSource,
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
} from "./contracts";
import { localTrackPublisher } from "./livekit-local-track-publisher";
import {
  CONNECT_OPTIONS,
  joinFailure,
  untilAborted,
} from "./livekit-room-join";

export type LivekitRoomModule = Pick<
  LivekitClient,
  | "ConnectionError"
  | "ConnectionErrorReason"
  | "Room"
  | "RoomEvent"
  | "ScreenSharePresets"
  | "Track"
  | "VideoQuality"
>;

// Publishers stop encoding the camera layers nobody subscribes to.
const ROOM_OPTIONS = { dynacast: true };

function connectionQualityOf(quality: string): ConnectionQuality {
  return CONNECTION_QUALITIES.find((known) => known === quality) ?? "unknown";
}

type TrackOwner = Readonly<{
  participantId: string;
  source: PublicationSource;
}>;

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
  const { RoomEvent, ScreenSharePresets, Track, VideoQuality } = livekit;
  const VIDEO_QUALITY: Readonly<Record<VideoLayer, number>> = {
    low: VideoQuality.LOW,
    medium: VideoQuality.MEDIUM,
    high: VideoQuality.HIGH,
  };
  let audience: MeetingAudience = {
    participantIds: new Set(),
    video: NO_VIDEO_DEMAND,
  };
  let reportedSharesKey = "";
  let heardRemoteAudio = false;
  let sawRemoteVideo = false;
  let leaving = false;
  const cameraAskedAt = new Map<string, number>();
  const grant = audienceGrant(room);
  const handedOver = new Set<string>();
  let sharePublishedAt: number | undefined;
  const publishers: Readonly<
    Record<PublicationSource, ReturnType<typeof localTrackPublisher>>
  > = {
    camera: localTrackPublisher(room, Track.Source.Camera),
    microphone: localTrackPublisher(room, Track.Source.Microphone),
    screen: localTrackPublisher(room, Track.Source.ScreenShare, {
      screenShareEncoding: ScreenSharePresets.h1080fps15.encoding,
    }),
  };

  async function handleLocalPublicationChange(change: LocalPublicationChange) {
    const source = localChangeSource(change);
    if (source === "screen") {
      sharePublishedAt = change.type === "added" ? now() : undefined;
    }
    await publishers[source].handle(change);
  }

  function reportFirstScreenViewer({ source }: TrackPublication) {
    if (source !== Track.Source.ScreenShare || sharePublishedAt === undefined) {
      return;
    }
    const waitedMs = now() - sharePublishedAt;
    sharePublishedAt = undefined;
    events.onFirstScreenViewer({
      connectionQuality: connectionQualityOf(
        room.localParticipant.connectionQuality,
      ),
      waitedMs,
    });
  }

  function grantAudience() {
    grant(audience.participantIds);
  }

  function publicationSourceOf({
    source,
  }: RemoteTrackPublication): PublicationSource | undefined {
    if (source === Track.Source.Microphone) return "microphone";
    if (source === Track.Source.Camera) return "camera";
    if (source === Track.Source.ScreenShare) return "screen";
    return undefined;
  }

  function ownerOf(
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ): TrackOwner | undefined {
    const source = publicationSourceOf(publication);
    const participantId = source && parseParticipantId(participant.identity);
    return participantId && source ? { participantId, source } : undefined;
  }

  function isWanted({ participantId, source }: TrackOwner) {
    return source === "microphone"
      ? audience.participantIds.has(participantId)
      : audience.video[source].has(participantId);
  }

  function layerOf({ participantId, source }: TrackOwner) {
    return source === "microphone"
      ? undefined
      : audience.video[source].get(participantId);
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
    resubscribed: boolean,
  ) {
    const quality = VIDEO_QUALITY[layer];
    const repeated = resubscribed && publication.videoQuality === quality;
    publication.setVideoQuality(quality);
    // The SFU forgets a track's settings once it unsubscribes, and LiveKit
    // stays quiet about a layer it already asked for.
    if (repeated) publication.emitTrackUpdate();
  }

  function updateSubscription(
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) {
    const owner = wantedOwnerOf(publication, participant);
    const wanted = owner !== undefined;
    const asked = wanted && !publication.isDesired;
    if (publication.isDesired !== wanted) {
      publication.setSubscribed(wanted);
      if (wanted && owner.source === "camera") {
        cameraAskedAt.set(publication.trackSid, now());
      }
    }
    const layer = owner && layerOf(owner);
    if (layer) requestLayer(publication, layer, asked);
    // A track that arrived while unwanted fires no second event if the SFU
    // never got round to unsubscribing it.
    const { track, trackSid } = publication;
    if (wanted && track && !handedOver.has(trackSid)) {
      forwardSubscribedTrack(track, publication, participant);
    }
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
    if (owner.source === "microphone") reportFirstAudio();
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
  // ones, and a member's own mutes are never in it. Only a tile needs to know:
  // an upsert re-attaches its element, which would clip a microphone's audio.
  function forwardMute(
    { trackSid }: TrackPublication,
    { identity }: Participant,
  ) {
    const participant = room.remoteParticipants.get(identity);
    const publication = participant?.trackPublications.get(trackSid);
    const owner =
      participant && publication && wantedOwnerOf(publication, participant);
    if (owner && owner.source !== "microphone" && publication?.track)
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

  function isSharing({ trackPublications }: RemoteParticipant) {
    return [...trackPublications.values()].some(
      ({ source }) => source === Track.Source.ScreenShare,
    );
  }

  // Reads the room, not the event: a share already there when its owner joins
  // the roster announces nothing.
  function reportRemoteScreenShares() {
    const sharing = [...room.remoteParticipants.values()]
      .filter(isSharing)
      .flatMap(({ identity }) => parseParticipantId(identity) ?? [])
      .filter((participantId) => audience.participantIds.has(participantId));
    const key = sharing.toSorted().join("\n");
    if (key === reportedSharesKey) return;
    reportedSharesKey = key;
    events.onRemoteScreenSharesChange(new Set(sharing));
  }

  room
    .on(RoomEvent.ParticipantConnected, grantAudience)
    .on(RoomEvent.ParticipantDisconnected, reportRemoteScreenShares)
    .on(RoomEvent.TrackPublished, reportRemoteScreenShares)
    .on(RoomEvent.TrackUnpublished, reportRemoteScreenShares)
    .on(RoomEvent.LocalTrackSubscribed, reportFirstScreenViewer)
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
      reportRemoteScreenShares();
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
