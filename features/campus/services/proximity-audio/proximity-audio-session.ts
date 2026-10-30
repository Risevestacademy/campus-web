import { type Hearing, hearingOf, type Presence } from "@/core/presence";
import type { Call, ServerMessage } from "@/core/realtime";

import type {
  LocalMediaPublication,
  LocalPublicationChange,
  MeetingMediaTransportCallbacks,
  RemotePublicationChange,
} from "../media-session/contracts";
import {
  type MeetingRoomConnection,
  type MeetingRoomEvents,
  type MeetingRoomTransport,
  type ProximityAudioSession,
  RoomAccessDeniedError,
} from "./contracts";

type ProximityAudioSessionOptions = Readonly<{
  now: () => number;
  pinMediaUrl: (url: string) => string | undefined;
  recordFirstAudioMilliseconds: (
    milliseconds: number,
    hearing: Hearing,
  ) => void;
  // Asks World to send the call again with a fresh token; false when World
  // cannot be asked right now.
  refreshCall: () => boolean;
  roomTransport: MeetingRoomTransport;
}>;

type HeardCall = Call & Readonly<{ hearing: Hearing }>;

type ActiveRoom = Readonly<{
  audibleRadius: number;
  connection: MeetingRoomConnection;
  hearing: Hearing;
}>;

type Position = Readonly<{ x: number; y: number }>;

type PublicationRemoval = Extract<RemotePublicationChange, { type: "removed" }>;

// How long to wait for World's fresh call before offering Try again again. A
// call that arrives later still joins on World's own path.
const CALL_REFRESH_TIMEOUT_MS = 15_000;

const POLICY_FRAMES: ReadonlySet<ServerMessage["type"]> = new Set([
  "snapshot",
  "joined",
  "left",
  "moved",
  "moveResult",
  "nearby",
  "spaceChanged",
]);

function remoteAudioGain(
  self: Position | undefined,
  peer: Position | undefined,
  audibleRadius: number,
) {
  if (!self || !peer || audibleRadius === 0) return 0;
  const distance = Math.hypot(peer.x - self.x, peer.y - self.y);
  return Math.max(0, 1 - distance / audibleRadius);
}

export function createProximityAudioSession(
  options: ProximityAudioSessionOptions,
): ProximityAudioSession {
  let callbacks: MeetingMediaTransportCallbacks | undefined;
  let active: ActiveRoom | undefined;
  let pendingJoin: AbortController | undefined;
  let localMicrophone: LocalMediaPublication | undefined;
  let latestPresence: Presence | undefined;
  let latestCall: HeardCall | undefined;
  const pendingRemovals = new Map<string, PublicationRemoval>();
  // Bumped whenever the current room ends; async work from an older generation
  // is stale and must not touch state or callbacks.
  let roomGeneration = 0;
  // Room joins and disconnects run one at a time, so an old room always
  // finishes leaving before the next one joins.
  let transition = Promise.resolve();

  function enqueue(
    step: () => Promise<void>,
    onError: (error: unknown) => void,
  ) {
    transition = transition.then(step).catch(onError);
  }

  function currentCallbacks(stepGeneration: number) {
    return stepGeneration === roomGeneration ? callbacks : undefined;
  }

  function applyPolicy() {
    if (!callbacks || !active || !latestPresence) return;
    const { audibleRadius, connection, hearing } = active;
    const { meetingRoster, positions, selfId } = latestPresence;
    const selfPosition = selfId ? positions.get(selfId) : undefined;

    connection.setSubscribedParticipantIds(new Set(meetingRoster));
    callbacks.onRemoteAudioGainsChange(
      Object.fromEntries(
        meetingRoster.map((participantId) => [
          participantId,
          hearing === "room"
            ? 1
            : remoteAudioGain(
                selfPosition,
                positions.get(participantId),
                audibleRadius,
              ),
        ]),
      ),
    );
  }

  function forwardRemoteChange(change: RemotePublicationChange) {
    const { participantId, publicationId, source } =
      change.type === "removed" ? change : change.publication;
    const key = `${participantId}:${source}`;
    if (change.type === "removed") pendingRemovals.delete(key);
    else {
      pendingRemovals.set(key, {
        participantId,
        publicationId,
        source,
        type: "removed",
      });
    }
    callbacks?.onRemotePublicationChange(change);
  }

  function clearRemoteAudio() {
    const removals = [...pendingRemovals.values()];
    pendingRemovals.clear();
    for (const removal of removals)
      callbacks?.onRemotePublicationChange(removal);
    callbacks?.onRemoteAudioGainsChange({});
  }

  function closeRoom() {
    roomGeneration += 1;
    pendingJoin?.abort();
    pendingJoin = undefined;
    const connection = active?.connection;
    active = undefined;
    clearRemoteAudio();
    if (connection) {
      // The room is already detached; a failed disconnect leaves nothing to undo.
      enqueue(
        () => connection.disconnect(),
        () => undefined,
      );
    }
  }

  function fail(stepGeneration: number) {
    const current = currentCallbacks(stepGeneration);
    if (!current) return;
    closeRoom();
    current.onStatusChange("unavailable");
  }

  function forwardLocalChange(change: LocalPublicationChange) {
    if (!active) return;
    const stepGeneration = roomGeneration;
    active.connection
      .handleLocalPublicationChange(change)
      .catch(() => fail(stepGeneration));
  }

  function roomEvents(
    stepGeneration: number,
    receivedAt: number | undefined,
    hearing: Hearing,
  ): MeetingRoomEvents {
    let unmeasuredSince = receivedAt;
    return {
      onDisconnected: () => fail(stepGeneration),
      onFirstRemoteAudio: () => {
        if (
          unmeasuredSince === undefined ||
          !currentCallbacks(stepGeneration)
        ) {
          return;
        }
        options.recordFirstAudioMilliseconds(
          options.now() - unmeasuredSince,
          hearing,
        );
        unmeasuredSince = undefined;
      },
      onRemotePublicationChange: (change) => {
        if (currentCallbacks(stepGeneration)) forwardRemoteChange(change);
      },
    };
  }

  async function connectAbortably(
    access: Readonly<{ url: string; token: string }>,
    events: MeetingRoomEvents,
  ) {
    const controller = new AbortController();
    pendingJoin = controller;
    try {
      return await options.roomTransport.connect(
        access,
        events,
        controller.signal,
      );
    } finally {
      pendingJoin = undefined;
    }
  }

  async function join(
    call: HeardCall,
    stepGeneration: number,
    receivedAt: number | undefined,
  ) {
    const starting = currentCallbacks(stepGeneration);
    if (!starting) return;
    const url = options.pinMediaUrl(call.url);
    if (!url) {
      starting.onStatusChange("unavailable");
      return;
    }

    starting.onStatusChange("connecting");
    const connection = await connectAbortably(
      { url, token: call.token },
      roomEvents(stepGeneration, receivedAt, call.hearing),
    );

    const current = currentCallbacks(stepGeneration);
    if (!current) {
      await connection.disconnect();
      return;
    }

    active = {
      audibleRadius: call.audibleRadius,
      connection,
      hearing: call.hearing,
    };
    current.onStatusChange("connected");
    applyPolicy();
    if (localMicrophone) {
      forwardLocalChange({ publication: localMicrophone, type: "added" });
    }
  }

  function leave() {
    latestCall = undefined;
    closeRoom();
    callbacks?.onStatusChange("idle");
  }

  function measuredFromNow(presence: Presence) {
    return presence.meetingRoster.length > 0 ? options.now() : undefined;
  }

  function joinLatestCall(
    onFailure: (error: unknown, stepGeneration: number) => void = (
      _error,
      stepGeneration,
    ) => fail(stepGeneration),
    measuredFrom: (presence: Presence) => number | undefined = measuredFromNow,
  ) {
    if (!latestCall || !latestPresence) return;
    const call = latestCall;
    closeRoom();
    const stepGeneration = roomGeneration;
    const receivedAt = measuredFrom(latestPresence);
    enqueue(
      () => join(call, stepGeneration, receivedAt),
      (error) => onFailure(error, stepGeneration),
    );
  }

  // Only the member's own retry refreshes: a refused grant on World's fresh
  // call would otherwise cycle World's socket forever.
  function refreshOrFail(error: unknown, stepGeneration: number) {
    if (
      !(error instanceof RoomAccessDeniedError) ||
      !currentCallbacks(stepGeneration)
    ) {
      fail(stepGeneration);
      return;
    }
    if (!options.refreshCall()) {
      fail(stepGeneration);
      return;
    }
    // A fresh call starts a new room generation, which makes this a no-op.
    setTimeout(() => fail(stepGeneration), CALL_REFRESH_TIMEOUT_MS);
  }

  // First-audio time measures World's calls, so a retry is never measured.
  function retry() {
    joinLatestCall(refreshOrFail, () => undefined);
  }

  function applyWorldMessage(message: ServerMessage, presence: Presence) {
    latestPresence = presence;
    if (message.type !== "call") {
      if (POLICY_FRAMES.has(message.type)) applyPolicy();
      return;
    }

    const hearing = hearingOf(message.call);
    if (!message.call || !hearing) {
      leave();
      return;
    }

    latestCall = { ...message.call, hearing };
    joinLatestCall();
  }

  function applyPresence(presence: Presence) {
    latestPresence = presence;
    applyPolicy();
  }

  function handleLocalPublicationChange(change: LocalPublicationChange) {
    const source =
      change.type === "removed" ? change.source : change.publication.source;
    if (source !== "microphone") return;

    localMicrophone =
      change.type === "removed" ? undefined : change.publication;
    forwardLocalChange(change);
  }

  return {
    applyPresence,
    applyWorldMessage,
    connect(nextCallbacks) {
      if (callbacks) return () => undefined;
      callbacks = nextCallbacks;
      // World sends a call once per space, so one that came before this
      // connect would otherwise never join.
      joinLatestCall();

      return () => {
        localMicrophone = undefined;
        closeRoom();
        callbacks = undefined;
      };
    },
    handleLocalPublicationChange,
    retry,
  };
}
