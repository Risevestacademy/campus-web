import type {
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
} from "livekit-client";

import {
  parseParticipantId,
  parseParticipantName,
} from "../../schemas/livekit-participant.schema";
import {
  type LivekitClient,
  loadLivekitClient,
} from "../livekit/livekit-client";
import type {
  BroadcastRoomConnection,
  BroadcastRoomEvents,
  BroadcastRoomTransport,
} from "./contracts";
import {
  CONNECT_OPTIONS,
  joinFailure,
  untilAborted,
} from "./livekit-room-join";

export type LivekitBroadcastModule = Pick<
  LivekitClient,
  "ConnectionError" | "ConnectionErrorReason" | "Room" | "RoomEvent" | "Track"
>;

// Listens only: every microphone of a participant World named, and nothing
// else, since a broadcast carries voice alone.
function listenTo(
  { RoomEvent, Track }: LivekitBroadcastModule,
  room: Room,
  events: BroadcastRoomEvents,
) {
  const handedOver = new Set<string>();
  let leaving = false;

  function speakerOf(
    { source }: RemoteTrackPublication,
    { identity }: RemoteParticipant,
  ) {
    return source === Track.Source.Microphone
      ? parseParticipantId(identity)
      : undefined;
  }

  function subscribe(
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) {
    if (speakerOf(publication, participant) && !publication.isDesired) {
      publication.setSubscribed(true);
    }
  }

  function subscribeAll() {
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        subscribe(publication, participant);
      }
    }
  }

  function forwardSubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) {
    const participantId = speakerOf(publication, participant);
    if (!participantId) return;
    handedOver.add(publication.trackSid);
    events.onRemotePublicationChange({
      publication: {
        enabled: !publication.isMuted,
        origin: "remote",
        participantId,
        publicationId: publication.trackSid,
        source: "microphone",
        speakerName: parseParticipantName(participant.name),
        stream: track.mediaStream ?? new MediaStream([track.mediaStreamTrack]),
        track: track.mediaStreamTrack,
      },
      type: "upserted",
    });
  }

  function forwardRemoved(
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) {
    const participantId = speakerOf(publication, participant);
    if (!participantId || !handedOver.delete(publication.trackSid)) return;
    events.onRemotePublicationChange({
      participantId,
      publicationId: publication.trackSid,
      source: "microphone",
      type: "removed",
    });
  }

  room
    .on(RoomEvent.TrackPublished, subscribe)
    .on(RoomEvent.TrackSubscribed, forwardSubscribed)
    .on(RoomEvent.TrackUnsubscribed, (_track, publication, participant) =>
      forwardRemoved(publication, participant),
    )
    .on(RoomEvent.TrackUnpublished, forwardRemoved)
    .on(RoomEvent.Disconnected, () => {
      if (!leaving) events.onDisconnected();
    });

  const connection: BroadcastRoomConnection = {
    async disconnect() {
      leaving = true;
      await room.disconnect(true).catch(() => undefined);
    },
  };
  return { connection, subscribeAll };
}

export function createLivekitBroadcastRoomTransport(
  load: () => Promise<LivekitBroadcastModule> = loadLivekitClient,
): BroadcastRoomTransport {
  return {
    async connect({ url, token }, events, signal) {
      const livekit = await untilAborted(load(), signal);
      const room = new livekit.Room();
      const { connection, subscribeAll } = listenTo(livekit, room, events);

      try {
        await untilAborted(room.connect(url, token, CONNECT_OPTIONS), signal);
      } catch (error) {
        void connection.disconnect();
        throw joinFailure(livekit, error);
      }
      // Whoever was already speaking announces nothing.
      subscribeAll();
      return connection;
    },
  };
}
