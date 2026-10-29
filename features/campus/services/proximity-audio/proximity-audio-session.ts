import type { Presence } from "@/core/presence";
import type { Call, ServerMessage } from "@/core/realtime";

import type {
  LocalMediaPublication,
  LocalPublicationChange,
  MeetingMediaTransportCallbacks,
  RemotePublicationChange,
} from "../media-session/contracts";
import type {
  MeetingRoomConnection,
  MeetingRoomEvents,
  MeetingRoomTransport,
  ProximityAudioSession,
} from "./contracts";

type ProximityAudioSessionOptions = Readonly<{
  now: () => number;
  pinMediaUrl: (url: string) => string | undefined;
  recordFirstAudioMilliseconds: (milliseconds: number) => void;
  roomTransport: MeetingRoomTransport;
}>;

type ActiveRoom = Readonly<{
  audibleRadius: number;
  connection: MeetingRoomConnection;
}>;

type Position = Readonly<{ x: number; y: number }>;

type PublicationRemoval = Extract<RemotePublicationChange, { type: "removed" }>;

const POLICY_FRAMES: ReadonlySet<ServerMessage["type"]> = new Set([
  "snapshot",
  "joined",
  "left",
  "moved",
  "moveResult",
  "nearby",
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

function nearbyParticipantIds(presence: Presence): ReadonlySet<string> {
  return new Set(
    presence.nearby.filter(
      (participantId) =>
        participantId !== presence.selfId &&
        presence.participants.has(participantId),
    ),
  );
}

export function createProximityAudioSession(
  options: ProximityAudioSessionOptions,
): ProximityAudioSession {
  let callbacks: MeetingMediaTransportCallbacks | undefined;
  let active: ActiveRoom | undefined;
  let pendingJoin: AbortController | undefined;
  let localMicrophone: LocalMediaPublication | undefined;
  let latestPresence: Presence | undefined;
  let latestCall: Call | undefined;
  const pendingRemovals = new Map<string, PublicationRemoval>();
  // Bumped whenever the current room ends; async work from an older generation
  // is stale and must not touch state or callbacks.
  let roomGeneration = 0;
  // Room joins and disconnects run one at a time, so an old room always
  // finishes leaving before the next one joins.
  let transition = Promise.resolve();

  function enqueue(step: () => Promise<void>, onError: () => void) {
    transition = transition.then(step).catch(onError);
  }

  function currentCallbacks(stepGeneration: number) {
    return stepGeneration === roomGeneration ? callbacks : undefined;
  }

  function applyPolicy() {
    if (!callbacks || !active || !latestPresence) return;
    const { audibleRadius, connection } = active;
    const { positions, selfId } = latestPresence;
    const participantIds = nearbyParticipantIds(latestPresence);
    const selfPosition = selfId ? positions.get(selfId) : undefined;

    connection.setSubscribedParticipantIds(participantIds);
    callbacks.onRemoteAudioGainsChange(
      Object.fromEntries(
        [...participantIds].map((participantId) => [
          participantId,
          remoteAudioGain(
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
        options.recordFirstAudioMilliseconds(options.now() - unmeasuredSince);
        unmeasuredSince = undefined;
      },
      onRemotePublicationChange: (change) => {
        if (currentCallbacks(stepGeneration)) forwardRemoteChange(change);
      },
    };
  }

  async function join(
    call: Call,
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
    const controller = new AbortController();
    pendingJoin = controller;
    const connection = await options.roomTransport.connect(
      { url, token: call.token },
      roomEvents(stepGeneration, receivedAt),
      controller.signal,
    );

    const current = currentCallbacks(stepGeneration);
    if (!current) {
      await connection.disconnect();
      return;
    }

    pendingJoin = undefined;
    active = { audibleRadius: call.audibleRadius, connection };
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

  function joinLatestCall() {
    if (!latestCall || !latestPresence) return;
    const call = latestCall;
    closeRoom();
    const stepGeneration = roomGeneration;
    const receivedAt =
      latestPresence.nearby.length > 0 ? options.now() : undefined;
    enqueue(
      () => join(call, stepGeneration, receivedAt),
      () => fail(stepGeneration),
    );
  }

  function applyWorldMessage(message: ServerMessage, presence: Presence) {
    latestPresence = presence;
    if (message.type !== "call") {
      if (POLICY_FRAMES.has(message.type)) applyPolicy();
      return;
    }

    if (message.call?.hearing !== "proximity") {
      leave();
      return;
    }

    latestCall = message.call;
    joinLatestCall();
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
  };
}
