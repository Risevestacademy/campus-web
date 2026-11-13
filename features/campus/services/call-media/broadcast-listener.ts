import type { Presence } from "@/core/presence";
import type { BroadcastCall, ServerMessage } from "@/core/realtime";

import type {
  BroadcastPublicationChange,
  RemotePublicationChange,
} from "../media-session/contracts";
import type {
  BroadcastListener,
  BroadcastListenerCallbacks,
  BroadcastRoomConnection,
  BroadcastRoomTransport,
  CallMediaSession,
} from "./contracts";

type BroadcastListenerOptions = Readonly<{
  pinMediaUrl: (url: string) => string | undefined;
  roomTransport: BroadcastRoomTransport;
}>;

type PublicationRemoval = Extract<RemotePublicationChange, { type: "removed" }>;

// The cohort's broadcast room, beside the space's call: joined on each
// `broadcast`, kept while the member walks, and left on `null` or when the
// socket closes. World sends it again after the next snapshot.
export function createBroadcastListener(
  options: BroadcastListenerOptions,
): BroadcastListener {
  let callbacks: BroadcastListenerCallbacks | undefined;
  let latestCall: BroadcastCall | undefined;
  let active: BroadcastRoomConnection | undefined;
  let pendingJoin: AbortController | undefined;
  const pendingRemovals = new Map<string, PublicationRemoval>();
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
    if (!url) return;

    const controller = new AbortController();
    pendingJoin = controller;
    let connection: BroadcastRoomConnection;
    try {
      connection = await options.roomTransport.connect(
        { url, token: call.token },
        {
          onDisconnected: () => {
            if (isCurrent(stepGeneration)) closeRoom();
          },
          onRemotePublicationChange: (change) => {
            if (isCurrent(stepGeneration)) forward(change);
          },
        },
        controller.signal,
      );
    } finally {
      if (pendingJoin === controller) pendingJoin = undefined;
    }

    if (!isCurrent(stepGeneration)) {
      await connection.disconnect();
      return;
    }
    active = connection;
  }

  function joinLatestCall() {
    if (!latestCall) return;
    const call = latestCall;
    closeRoom();
    const stepGeneration = roomGeneration;
    enqueue(() => join(call, stepGeneration));
  }

  function leave() {
    latestCall = undefined;
    closeRoom();
  }

  return {
    applyWorldMessage(message) {
      if (message.type !== "broadcast") return;
      if (!message.call) {
        leave();
        return;
      }
      // A new token, even for the same room: World revokes the old one when
      // a role changes.
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
        closeRoom();
        callbacks = undefined;
      };
    },
  };
}

// The space's call and the broadcast room share one World feed and one
// lifecycle.
export function withBroadcastListener(
  callMedia: CallMediaSession,
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
  };
}
