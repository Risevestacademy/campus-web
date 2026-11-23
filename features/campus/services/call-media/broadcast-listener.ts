import type { Presence } from "@/core/presence";
import type { BroadcastCall, ServerMessage } from "@/core/realtime";

import {
  type BroadcastPublicationChange,
  type BroadcastSpeaking,
  localChangeSource,
  type LocalMediaPublication,
  type LocalPublicationChange,
  type RemotePublicationChange,
} from "../media-session/contracts";
import type {
  BroadcastListener,
  BroadcastListenerCallbacks,
  BroadcastRoomConnection,
  BroadcastRoomTransport,
  CallMediaSession,
  SpaceCallMediaSession,
} from "./contracts";

type BroadcastListenerOptions = Readonly<{
  pinMediaUrl: (url: string) => string | undefined;
  roomTransport: BroadcastRoomTransport;
}>;

type PublicationRemoval = Extract<RemotePublicationChange, { type: "removed" }>;

function removalOf(microphone: LocalMediaPublication): LocalPublicationChange {
  return {
    previousTrack: microphone.track,
    publicationId: microphone.publicationId,
    source: "microphone",
    type: "removed",
  };
}

// The cohort's broadcast room, beside the space's call: joined on each
// `broadcast`, kept while the member walks, and left on `null` or when the
// socket closes. World sends it again after the next snapshot.
//
// An admin may speak in it: their microphone, and nothing else, goes out
// while they ask to, World says they may (`canSpeak`), and the microphone is
// on. Losing any of those ends it; the member asks again to start over.
// Losing the room ends it too, as `failed`, since the member did not choose
// it: a drop, or a join that fails or cannot be pinned.
export function createBroadcastListener(
  options: BroadcastListenerOptions,
): BroadcastListener {
  let callbacks: BroadcastListenerCallbacks | undefined;
  let latestCall: BroadcastCall | undefined;
  let active: BroadcastRoomConnection | undefined;
  let pendingJoin: AbortController | undefined;
  const pendingRemovals = new Map<string, PublicationRemoval>();
  let microphone: LocalMediaPublication | undefined;
  let wantsToSpeak = false;
  let speaking: BroadcastSpeaking = "off";
  // From asking for a room until it joins or fails. Speaking may start then,
  // and the microphone goes out once the room is in.
  let awaitingRoom = false;
  // Bumped whenever the current room ends; async work from an older
  // generation is stale and must not touch state or callbacks.
  let roomGeneration = 0;
  // The old room finishes leaving before the next one joins.
  let transition = Promise.resolve();

  function enqueue(step: () => Promise<void>) {
    // A failed join or leave leaves nothing to undo: the member stays out
    // until World's next broadcast.
    transition = transition.then(step).catch(() => undefined);
  }

  function isCurrent(stepGeneration: number) {
    return stepGeneration === roomGeneration && callbacks !== undefined;
  }

  function report(next: BroadcastSpeaking) {
    if (next === speaking) return;
    speaking = next;
    callbacks?.onBroadcastSpeakingChange(next);
  }

  function isPublishing() {
    return wantsToSpeak && latestCall?.canSpeak === true && !!microphone;
  }

  // A refused microphone ends the broadcast; a refused take-down needs
  // nothing more, since leaving the room stops its copy either way.
  function sendToRoom(change: LocalPublicationChange) {
    const connection = active;
    if (!connection) return;
    const stepGeneration = roomGeneration;
    connection.handleLocalPublicationChange(change).catch(() => {
      if (change.type === "removed" || stepGeneration !== roomGeneration) {
        return;
      }
      stopSpeaking("failed");
    });
  }

  function stopSpeaking(outcome: Exclude<BroadcastSpeaking, "on">) {
    if (isPublishing() && microphone) sendToRoom(removalOf(microphone));
    wantsToSpeak = false;
    report(outcome);
  }

  function loseRoom() {
    awaitingRoom = false;
    if (wantsToSpeak) stopSpeaking("failed");
  }

  function forward(change: BroadcastPublicationChange) {
    if (change.type === "upserted") {
      const { participantId, publicationId } = change.publication;
      pendingRemovals.set(publicationId, {
        participantId,
        publicationId,
        source: "microphone",
        type: "removed",
      });
    } else {
      pendingRemovals.delete(change.publicationId);
    }
    callbacks?.onBroadcastPublicationChange(change);
  }

  function closeRoom() {
    roomGeneration += 1;
    pendingJoin?.abort();
    pendingJoin = undefined;
    const removals = [...pendingRemovals.values()];
    pendingRemovals.clear();
    for (const removal of removals) {
      callbacks?.onBroadcastPublicationChange(removal);
    }
    const connection = active;
    active = undefined;
    if (connection) enqueue(() => connection.disconnect());
  }

  async function join(call: BroadcastCall, stepGeneration: number) {
    if (!isCurrent(stepGeneration)) return;
    const url = options.pinMediaUrl(call.url);
    if (!url) {
      loseRoom();
      return;
    }

    const controller = new AbortController();
    pendingJoin = controller;
    let connection: BroadcastRoomConnection;
    try {
      connection = await options.roomTransport.connect(
        { url, token: call.token },
        {
          onDisconnected: () => {
            if (!isCurrent(stepGeneration)) return;
            closeRoom();
            loseRoom();
          },
          onRemotePublicationChange: (change) => {
            if (isCurrent(stepGeneration)) forward(change);
          },
        },
        controller.signal,
      );
    } catch (error) {
      if (isCurrent(stepGeneration)) loseRoom();
      throw error;
    } finally {
      if (pendingJoin === controller) pendingJoin = undefined;
    }

    if (!isCurrent(stepGeneration)) {
      await connection.disconnect();
      return;
    }
    active = connection;
    awaitingRoom = false;
    // The token that may speak is only good for joining within a minute, so
    // the microphone goes out as soon as the room is joined.
    if (isPublishing() && microphone) {
      sendToRoom({ publication: microphone, type: "added" });
    }
  }

  function joinLatestCall() {
    if (!latestCall) return;
    const call = latestCall;
    closeRoom();
    awaitingRoom = true;
    const stepGeneration = roomGeneration;
    enqueue(() => join(call, stepGeneration));
  }

  function leave() {
    stopSpeaking("off");
    latestCall = undefined;
    awaitingRoom = false;
    closeRoom();
  }

  function startSpeaking() {
    if (!latestCall?.canSpeak) {
      report("off");
      return;
    }
    // Without a room, nothing would go out until World's next broadcast.
    if (!microphone || (!active && !awaitingRoom)) {
      report("failed");
      return;
    }
    if (wantsToSpeak) return;
    wantsToSpeak = true;
    report("on");
    sendToRoom({ publication: microphone, type: "added" });
  }

  function handleMicrophoneChange(change: LocalPublicationChange) {
    if (change.type === "removed") {
      // Turning the microphone off ends the broadcast with it.
      stopSpeaking("off");
      microphone = undefined;
      return;
    }
    microphone = change.publication;
    if (isPublishing()) sendToRoom(change);
  }

  return {
    applyWorldMessage(message) {
      if (message.type !== "broadcast") return;
      if (!message.call) {
        leave();
        return;
      }
      // A new token, even for the same room: World revokes the old one when
      // a role changes. One that may not speak ends the member's broadcast;
      // leaving the old room takes the microphone down.
      if (!message.call.canSpeak && wantsToSpeak) {
        wantsToSpeak = false;
        report("off");
      }
      latestCall = message.call;
      joinLatestCall();
    },
    applyPresence(presence: Presence) {
      if (presence.broadcast === null && latestCall) leave();
    },
    connect(nextCallbacks) {
      if (callbacks) return () => undefined;
      callbacks = nextCallbacks;
      // World sends the broadcast once per arrival, so one that came before
      // this connect would otherwise never join.
      joinLatestCall();

      return () => {
        wantsToSpeak = false;
        report("off");
        microphone = undefined;
        awaitingRoom = false;
        closeRoom();
        callbacks = undefined;
      };
    },
    handleLocalPublicationChange(change) {
      if (localChangeSource(change) === "microphone") {
        handleMicrophoneChange(change);
      }
    },
    setSpeaking(on) {
      if (on) startSpeaking();
      else stopSpeaking("off");
    },
  };
}

// The space's call and the broadcast room share one World feed and one
// lifecycle.
export function withBroadcastListener(
  callMedia: SpaceCallMediaSession,
  broadcast: BroadcastListener,
): CallMediaSession {
  return {
    ...callMedia,
    applyPresence(presence) {
      callMedia.applyPresence(presence);
      broadcast.applyPresence(presence);
    },
    applyWorldMessage(message: ServerMessage, presence) {
      callMedia.applyWorldMessage(message, presence);
      broadcast.applyWorldMessage(message, presence);
    },
    connect(callbacks) {
      const disconnectCall = callMedia.connect(callbacks);
      const stopListening = broadcast.connect(callbacks);
      return () => {
        stopListening();
        disconnectCall();
      };
    },
    handleLocalPublicationChange(change) {
      callMedia.handleLocalPublicationChange(change);
      broadcast.handleLocalPublicationChange(change);
    },
    setBroadcastSpeaking: broadcast.setSpeaking,
  };
}
