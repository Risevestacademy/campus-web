import { expect, vi } from "vitest";

import { createPresenceStore } from "@/core/presence";
import type { Avatar } from "@/core/realtime";
import { parseServerMessage } from "@/core/realtime";
import { parseParticipantId } from "@/features/campus/schemas/livekit-participant.schema";
import { createCallMediaSession } from "@/features/campus/services/call-media/call-media-session";
import { createLivekitMeetingRoomTransport } from "@/features/campus/services/call-media/livekit-meeting-room-transport";
import type {
  CallAudioStatus,
  VideoLayer,
} from "@/features/campus/services/media-session/contracts";
import {
  fakeLivekitRoom,
  type FakeRoom,
} from "@/features/campus/testing/fake-livekit";
import { ADA, GRACE, LIN, MAYA } from "@/tests/fixtures/nearby-presence";
import { serverFrames } from "@/tests/fixtures/world-frames";

export function proximityCall() {
  const { call } = serverFrames.call;
  if (!call) throw new Error("The call fixture must grant a room.");
  return call;
}

const MEDIA_URL = proximityCall().url;

export const identityOf = (userId: string) => `${userId}:tab-1`;

// One member's Presence Session, end to end below World: frames go through the
// real parser and presence store into the real call-media session and
// LiveKit adapter. Only livekit-client is faked.
export function joinedMember() {
  const livekit = fakeLivekitRoom();
  livekit.control.alreadyInRoom = [
    [identityOf(GRACE.userId), ["microphone", "camera", "screen_share"]],
    [identityOf(LIN.userId), ["microphone", "camera"]],
    [identityOf(MAYA.userId), ["microphone", "camera"]],
    [GRACE.userId, ["microphone", "camera"]],
  ];
  const presence = createPresenceStore();
  let worldRefreshes = 0;
  let tilesOnScreen: ReadonlySet<string> = new Set();
  const session = createCallMediaSession({
    now: () => 0,
    pinMediaUrl: (url) => (url === MEDIA_URL ? url : undefined),
    recordFirstAudioMilliseconds: () => undefined,
    recordFirstVideo: () => undefined,
    // World answers a rejoin with the space's call and a freshly minted token,
    // which LiveKit accepts.
    refreshCall: () => {
      worldRefreshes += 1;
      livekit.control.connect = "resolve";
      receive({
        ...serverFrames.call,
        call: { ...proximityCall(), token: "fresh-token" },
      });
      return true;
    },
    roomTransport: createLivekitMeetingRoomTransport(
      async () => livekit.module,
    ),
  });
  const statuses: CallAudioStatus[] = [];
  const heard = new Set<string>();
  const seen = new Set<string>();
  session.connect({
    onCameraPublishFailed: () => undefined,
    onRemoteAudioGainsChange: () => undefined,
    onRemotePublicationChange: (change) => {
      const { participantId, source } =
        change.type === "upserted" ? change.publication : change;
      const shown = source === "camera" ? seen : heard;
      const live = change.type === "upserted" && change.publication.enabled;
      if (live) shown.add(participantId);
      else shown.delete(participantId);
    },
    onStatusChange: (status) => statuses.push(status),
  });
  let counted = 0;
  let unauthorizedSubscriptions = 0;
  let countedGrants = 0;
  let unauthorizedGrants = 0;

  // Read with the production parser, so an identity production must never
  // grant, like a bare user id, always counts as outside the roster.
  function isOutsideRoster(identity: string) {
    const userId = parseParticipantId(identity);
    return !userId || !presence.getState().meetingRoster.includes(userId);
  }

  function isUnwanted({
    identity,
    source,
  }: {
    identity: string;
    source: string;
  }) {
    if (isOutsideRoster(identity)) return true;
    const userId = parseParticipantId(identity) ?? "";
    return source === "camera" && !tilesOnScreen.has(userId);
  }

  function countUnauthorized() {
    for (const record of livekit.subscriptions.slice(counted)) {
      if (record.subscribed && isUnwanted(record)) {
        unauthorizedSubscriptions += 1;
      }
    }
    counted = livekit.subscriptions.length;

    for (const grant of livekit.grants.slice(countedGrants)) {
      if (
        grant.allParticipantsAllowed ||
        grant.identities.some(isOutsideRoster)
      ) {
        unauthorizedGrants += 1;
      }
    }
    countedGrants = livekit.grants.length;
  }

  function receive(frame: unknown) {
    const parsed = parseServerMessage(JSON.stringify(frame));
    if (!parsed.ok) throw new Error("The eval sent a frame world would not.");
    presence.getState().apply(parsed.message);
    session.applyWorldMessage(parsed.message, presence.getState());
    countUnauthorized();
  }

  // What the media session forwards once the meeting tiles settle.
  function showTiles(...tiles: (readonly [Avatar, VideoLayer])[]) {
    tilesOnScreen = new Set(tiles.map(([{ userId }]) => userId));
    session.setVideoDemand(
      new Map(tiles.map(([{ userId }, layer]) => [userId, layer])),
    );
    countUnauthorized();
  }

  // What the world session does on a recoverable close.
  function worldCloses() {
    presence.getState().clearRemoteParticipants();
    session.applyPresence(presence.getState());
    countUnauthorized();
  }

  function subscribedIn(room: FakeRoom) {
    return [...room.remoteParticipants.values()].flatMap((participant) =>
      [...participant.trackPublications.values()]
        .filter(({ isDesired }) => isDesired)
        .map(({ source }) => `${participant.identity}/${source}`),
    );
  }

  function participantIn(room: FakeRoom, { userId }: Avatar) {
    const participant = room.remoteParticipants.get(identityOf(userId));
    if (!participant) throw new Error(`${userId} is not in the room.`);
    return participant;
  }

  async function connected(roomCount = 1) {
    await vi.waitFor(() => {
      expect(livekit.rooms).toHaveLength(roomCount);
      expect(statuses.at(-1)).toBe("connected");
    });
    countUnauthorized();
  }

  receive(serverFrames.welcome);
  receive({
    type: "snapshot",
    map: serverFrames.snapshot.map,
    players: [ADA, GRACE, LIN, MAYA],
    spaces: [],
  });

  return {
    connected,
    heard,
    livekit,
    participantIn,
    receive,
    seen,
    showTiles,
    statuses,
    subscribedIn,
    tryAgain: () => session.retry(),
    worldCloses,
    worldRefreshes: () => worldRefreshes,
    unauthorizedGrants: () => unauthorizedGrants,
    unauthorizedSubscriptions: () => unauthorizedSubscriptions,
  };
}
