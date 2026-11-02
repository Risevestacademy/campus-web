import { type Hearing, hearingOf, type Presence } from "@/core/presence";
import type { Call, ServerMessage } from "@/core/realtime";

import {
  type CaptureSource,
  localChangeSource,
  type LocalMediaPublication,
  type LocalPublicationChange,
  type MeetingMediaTransportCallbacks,
  NO_VIDEO_DEMAND,
  type RemotePublicationChange,
  type ScreenShareEndReason,
  type VideoDemand,
} from "../media-session/contracts";
import {
  type CallMediaSession,
  type FirstRemoteVideo,
  type FirstScreenViewer,
  type MeetingRoomConnection,
  type MeetingRoomEvents,
  type MeetingRoomTransport,
  RoomAccessDeniedError,
} from "./contracts";

type CallMediaSessionOptions = Readonly<{
  now: () => number;
  pinMediaUrl: (url: string) => string | undefined;
  recordFirstAudioMilliseconds: (
    milliseconds: number,
    hearing: Hearing,
  ) => void;
  recordFirstVideo: (
    firstVideo: FirstRemoteVideo & Readonly<{ hearing: Hearing }>,
  ) => void;
  recordScreenShareEnded: (
    ended: Readonly<{
      durationMs: number;
      hearing: Hearing;
      reason: ScreenShareEndReason;
    }>,
  ) => void;
  recordScreenShareReady: (
    firstViewer: FirstScreenViewer & Readonly<{ hearing: Hearing }>,
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

type LocalPublications = Partial<Record<CaptureSource, LocalMediaPublication>>;

type AppliedAudience = Readonly<{
  connection: MeetingRoomConnection;
  demand: VideoDemand;
  roster: Presence["meetingRoster"];
}>;

// The microphone joins first, so a member is heard before they are seen.
const REPLAY_ORDER: readonly CaptureSource[] = ["microphone", "camera"];

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

function demandWithin(
  demand: VideoDemand,
  participantIds: ReadonlySet<string>,
): VideoDemand {
  const within = (layers: VideoDemand["camera"]) =>
    new Map(
      [...layers].filter(([participantId]) =>
        participantIds.has(participantId),
      ),
    );
  return { camera: within(demand.camera), screen: within(demand.screen) };
}

function remoteAudioGain(
  self: Position | undefined,
  peer: Position | undefined,
  audibleRadius: number,
) {
  if (!self || !peer || audibleRadius === 0) return 0;
  const distance = Math.hypot(peer.x - self.x, peer.y - self.y);
  return Math.max(0, 1 - distance / audibleRadius);
}

export function createCallMediaSession(
  options: CallMediaSessionOptions,
): CallMediaSession {
  let callbacks: MeetingMediaTransportCallbacks | undefined;
  let active: ActiveRoom | undefined;
  let pendingJoin: AbortController | undefined;
  let localPublications: LocalPublications = {};
  let latestPresence: Presence | undefined;
  let latestCall: HeardCall | undefined;
  let latestDemand = NO_VIDEO_DEMAND;
  let appliedAudience: AppliedAudience | undefined;
  let liveShare:
    | Readonly<{
        hearing: Hearing;
        publication: LocalMediaPublication;
        startedAt: number;
      }>
    | undefined;
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

  // Movement frames arrive constantly and rarely change who is met. Presence
  // and video demand both keep their reference until they really change.
  function applyAudience() {
    if (!callbacks || !active || !latestPresence) return;
    const { connection } = active;
    const roster = latestPresence.meetingRoster;
    if (
      appliedAudience?.connection === connection &&
      appliedAudience.roster === roster &&
      appliedAudience.demand === latestDemand
    ) {
      return;
    }
    appliedAudience = { connection, demand: latestDemand, roster };

    const participantIds = new Set(roster);
    connection.applyAudience({
      participantIds,
      video: demandWithin(latestDemand, participantIds),
    });
    if (roster.length === 0) {
      callbacks.onScreenShareEnded(
        latestPresence.hearing === "awaiting" ? "room_closed" : "meeting_ended",
      );
    }
  }

  function applyGains() {
    if (!callbacks || !active || !latestPresence) return;
    const { audibleRadius, hearing } = active;
    const { meetingRoster, positions, selfId } = latestPresence;
    const selfPosition = selfId ? positions.get(selfId) : undefined;

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

  function applyPolicy() {
    applyAudience();
    applyGains();
  }

  function forwardRemoteChange(change: RemotePublicationChange) {
    const { participantId, publicationId, source } =
      change.type === "removed" ? change : change.publication;
    const key = `${participantId}:${source}`;
    if (change.type === "upserted") {
      pendingRemovals.set(key, {
        participantId,
        publicationId,
        source,
        type: "removed",
      });
    } else if (pendingRemovals.get(key)?.publicationId === publicationId) {
      // A member who refreshes can publish again before the old track goes.
      pendingRemovals.delete(key);
    }
    callbacks?.onRemotePublicationChange(change);
  }

  function clearRemoteMedia() {
    const removals = [...pendingRemovals.values()];
    pendingRemovals.clear();
    for (const removal of removals)
      callbacks?.onRemotePublicationChange(removal);
    callbacks?.onRemoteAudioGainsChange({});
    callbacks?.onRemoteScreenSharesChange(new Set());
  }

  function closeRoom() {
    roomGeneration += 1;
    pendingJoin?.abort();
    pendingJoin = undefined;
    // First, while the room can still take the share down: leaving it to the
    // disconnect would keep showing the screen until that finishes.
    callbacks?.onScreenShareEnded("room_closed");
    const connection = active?.connection;
    active = undefined;
    clearRemoteMedia();
    callbacks?.onCameraPublishOutcome(false);
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

  // Video degrades before audio: a refused camera keeps the call, and a camera
  // that failed to turn off is still off for the member.
  function rejectLocalChange(
    change: LocalPublicationChange,
    stepGeneration: number,
  ) {
    const source = localChangeSource(change);
    if (source === "screen") {
      if (
        change.type === "added" &&
        change.publication === liveShare?.publication
      ) {
        currentCallbacks(stepGeneration)?.onScreenShareEnded("publish_failed");
      }
      return;
    }
    if (source !== "camera") {
      fail(stepGeneration);
      return;
    }
    currentCallbacks(stepGeneration)?.onCameraPublishOutcome(
      change.type !== "removed",
    );
  }

  function acceptLocalChange(
    change: LocalPublicationChange,
    stepGeneration: number,
  ) {
    if (localChangeSource(change) !== "camera") return;
    currentCallbacks(stepGeneration)?.onCameraPublishOutcome(false);
  }

  function forwardLocalChange(change: LocalPublicationChange) {
    if (!active) return;
    const stepGeneration = roomGeneration;
    active.connection.handleLocalPublicationChange(change).then(
      () => acceptLocalChange(change, stepGeneration),
      () => rejectLocalChange(change, stepGeneration),
    );
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
      onFirstRemoteVideo: (firstVideo) => {
        if (currentCallbacks(stepGeneration)) {
          options.recordFirstVideo({ ...firstVideo, hearing });
        }
      },
      onFirstScreenViewer: (firstViewer) => {
        if (currentCallbacks(stepGeneration)) {
          options.recordScreenShareReady({ ...firstViewer, hearing });
        }
      },
      onRemotePublicationChange: (change) => {
        if (currentCallbacks(stepGeneration)) forwardRemoteChange(change);
      },
      onRemoteScreenSharesChange: (participantIds) => {
        currentCallbacks(stepGeneration)?.onRemoteScreenSharesChange(
          participantIds,
        );
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
    replayLocalPublications();
  }

  function replayLocalPublications() {
    for (const source of REPLAY_ORDER) {
      const publication = localPublications[source];
      if (publication) forwardLocalChange({ publication, type: "added" });
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

  function startScreenShare(
    change: Extract<LocalPublicationChange, { type: "added" }>,
  ) {
    if (!active) {
      callbacks?.onScreenShareEnded("room_closed");
      return;
    }
    if (!latestPresence?.meetingRoster.length) {
      callbacks?.onScreenShareEnded("meeting_ended");
      return;
    }
    liveShare = {
      hearing: active.hearing,
      publication: change.publication,
      startedAt: options.now(),
    };
    forwardLocalChange(change);
  }

  function endScreenShare(
    change: Extract<LocalPublicationChange, { type: "removed" }>,
  ) {
    if (liveShare && change.endReason) {
      options.recordScreenShareEnded({
        durationMs: options.now() - liveShare.startedAt,
        hearing: liveShare.hearing,
        reason: change.endReason,
      });
    }
    liveShare = undefined;
    forwardLocalChange(change);
  }

  // A screen is never kept for replayLocalPublications: it must not reach the
  // audience of the next room.
  function handleLocalScreenChange(change: LocalPublicationChange) {
    if (change.type === "added") startScreenShare(change);
    if (change.type === "removed") endScreenShare(change);
  }

  function handleLocalPublicationChange(change: LocalPublicationChange) {
    const source = localChangeSource(change);
    if (source === "screen") {
      handleLocalScreenChange(change);
      return;
    }

    const { [source]: _previous, ...others } = localPublications;
    localPublications =
      change.type === "removed"
        ? others
        : { ...others, [source]: change.publication };
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
        localPublications = {};
        closeRoom();
        callbacks = undefined;
      };
    },
    handleLocalPublicationChange,
    retry,
    setVideoDemand(demand) {
      latestDemand = demand;
      applyAudience();
    },
  };
}
