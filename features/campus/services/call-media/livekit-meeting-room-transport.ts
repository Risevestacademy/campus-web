import type {
  LocalTrackPublication,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
} from "livekit-client";

import { parseParticipantId } from "../../schemas/livekit-participant.schema";
import {
  type LivekitClient,
  loadLivekitClient,
} from "../livekit/livekit-client";
import type {
  LocalPublicationChange,
  RemoteMediaPublication,
} from "../media-session/contracts";
import {
  type MeetingAudience,
  type MeetingRoomConnection,
  type MeetingRoomEvents,
  type MeetingRoomTransport,
  RoomAccessDeniedError,
} from "./contracts";

export type LivekitRoomModule = Pick<
  LivekitClient,
  "ConnectionError" | "ConnectionErrorReason" | "Room" | "RoomEvent" | "Track"
>;

const CONNECT_OPTIONS = { autoSubscribe: false, maxRetries: 3 };

function remoteMicrophone(
  participantId: string,
  track: RemoteTrack,
  publication: RemoteTrackPublication,
): RemoteMediaPublication {
  return {
    enabled: !publication.isMuted,
    origin: "remote",
    participantId,
    publicationId: publication.trackSid,
    source: "microphone",
    stream: track.mediaStream ?? new MediaStream([track.mediaStreamTrack]),
    track: track.mediaStreamTrack,
  };
}

// Publishes copies: LiveKit may stop a track it fails to publish, and the
// member's own track must outlive the room. Changes run in order, so turning
// the microphone off waits for a publish still in flight; any still queued at
// close never clone.
function microphonePublisher({ Track }: LivekitRoomModule, room: Room) {
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
        source: Track.Source.Microphone,
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

function connectRoom(
  livekit: LivekitRoomModule,
  room: Room,
  events: MeetingRoomEvents,
) {
  const { RoomEvent, Track } = livekit;
  let audience: MeetingAudience = { participantIds: new Set() };
  let grantedIdentities: string | undefined;
  let heardRemoteAudio = false;
  let leaving = false;
  const microphone = microphonePublisher(livekit, room);

  function microphoneOwnerId(
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) {
    return publication.source === Track.Source.Microphone
      ? parseParticipantId(participant.identity)
      : undefined;
  }

  function wantedParticipantId(
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) {
    const participantId = microphoneOwnerId(publication, participant);
    return participantId && audience.participantIds.has(participantId)
      ? participantId
      : undefined;
  }

  function updateSubscription(
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) {
    const wanted = wantedParticipantId(publication, participant) !== undefined;
    if (publication.isDesired !== wanted) publication.setSubscribed(wanted);
  }

  function audienceIdentities() {
    return [...room.remoteParticipants.values()]
      .map(({ identity }) => identity)
      .filter((identity) => {
        const participantId = parseParticipantId(identity);
        return participantId && audience.participantIds.has(participantId);
      })
      .toSorted();
  }

  // LiveKit lets anyone in the room subscribe until told otherwise, and keeps
  // the last grant across its own reconnects.
  function grantAudience() {
    const identities = audienceIdentities();
    const key = identities.join("\n");
    if (key === grantedIdentities) return;
    grantedIdentities = key;
    room.localParticipant.setTrackSubscriptionPermissions(
      false,
      identities.map((participantIdentity) => ({
        participantIdentity,
        allowAll: true,
      })),
    );
  }

  function forwardSubscribedTrack(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) {
    const participantId = wantedParticipantId(publication, participant);
    if (!participantId) return;

    events.onRemotePublicationChange({
      publication: remoteMicrophone(participantId, track, publication),
      type: "upserted",
    });
    if (heardRemoteAudio) return;
    heardRemoteAudio = true;
    events.onFirstRemoteAudio();
  }

  // Removal ignores the ask: dropping someone unsubscribes them first.
  function forwardRemovedTrack(
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) {
    const participantId = microphoneOwnerId(publication, participant);
    if (!participantId) return;

    events.onRemotePublicationChange({
      participantId,
      publicationId: publication.trackSid,
      source: "microphone",
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
      microphone.close();
    },
    handleLocalPublicationChange: microphone.handle,
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
): MeetingRoomTransport {
  return {
    async connect({ url, token }, events, signal) {
      const livekit = await untilAborted(load(), signal);
      const room = new livekit.Room();
      const { connection, grantAudience } = connectRoom(livekit, room, events);

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
