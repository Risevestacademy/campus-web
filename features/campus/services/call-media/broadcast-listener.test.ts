import { describe, expect, it, vi } from "vitest";

import { EMPTY_PRESENCE, type Presence } from "@/core/presence";
import type { BroadcastMessage, ServerMessage } from "@/core/realtime";

import {
  createTestMediaStream,
  createTestMediaTrack,
} from "../../testing/media-session-test-utils";
import type {
  BroadcastPublication,
  BroadcastPublicationChange,
  MeetingMediaTransportCallbacks,
} from "../media-session/contracts";
import {
  createBroadcastListener,
  withBroadcastListener,
} from "./broadcast-listener";
import type {
  BroadcastRoomConnection,
  BroadcastRoomEvents,
  BroadcastRoomTransport,
  CallMediaSession,
} from "./contracts";

const ADMIN_ID = "22222222-2222-4222-8222-222222222222";

function broadcastWith(token: string): BroadcastMessage {
  return {
    type: "broadcast",
    call: {
      url: "wss://media.example.test",
      room: "cohort-broadcast",
      token,
      canSpeak: false,
    },
  };
}

const BROADCAST = broadcastWith("listen-token");
const NO_BROADCAST: BroadcastMessage = { type: "broadcast", call: null };

function presenceOf(message: BroadcastMessage): Presence {
  return {
    ...EMPTY_PRESENCE,
    broadcast: message.call && {
      room: message.call.room,
      canSpeak: message.call.canSpeak,
    },
  };
}

// What a closed socket leaves behind: World sends the broadcast again on the
// next arrival.
const SOCKET_CLOSED: Presence = EMPTY_PRESENCE;

function adminMicrophone(publicationId = "admin-mic"): BroadcastPublication {
  const track = createTestMediaTrack("audio", publicationId);
  return {
    enabled: true,
    origin: "remote",
    participantId: ADMIN_ID,
    publicationId,
    source: "microphone",
    speakerName: "Grace Hopper",
    stream: createTestMediaStream([track]),
    track,
  };
}

type Room = Readonly<{
  access: Readonly<{ url: string; token: string }>;
  connection: BroadcastRoomConnection & {
    disconnect: ReturnType<typeof vi.fn>;
  };
  events: BroadcastRoomEvents;
  signal: AbortSignal;
}>;

function setup(
  options: Readonly<{
    join?: () => Promise<void>;
    pinMediaUrl?: (url: string) => string | undefined;
  }> = {},
) {
  const rooms: Room[] = [];
  const steps: string[] = [];
  const roomTransport: BroadcastRoomTransport = {
    connect: vi.fn(async (access, events, signal) => {
      steps.push(`join:${access.token}`);
      await options.join?.();
      signal.throwIfAborted();
      const connection = {
        disconnect: vi.fn(async () => {
          steps.push(`leave:${access.token}`);
        }),
      };
      rooms.push({ access, connection, events, signal });
      return connection;
    }),
  };
  const listener = createBroadcastListener({
    pinMediaUrl: options.pinMediaUrl ?? ((url) => `${url}/pinned`),
    roomTransport,
  });
  const changes: BroadcastPublicationChange[] = [];
  const callbacks = {
    onBroadcastPublicationChange: (change: BroadcastPublicationChange) =>
      changes.push(change),
  };

  function receive(message: BroadcastMessage) {
    listener.applyWorldMessage(message, presenceOf(message));
  }

  function roomAt(index: number) {
    const room = rooms[index];
    if (!room) throw new Error(`No room joined at ${index}.`);
    return room;
  }

  return { callbacks, changes, listener, receive, roomAt, rooms, steps };
}

async function settle() {
  await vi.waitFor(() => Promise.resolve());
  for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
}

describe("createBroadcastListener", () => {
  it("joins the broadcast room with World's token at the pinned media host", async () => {
    const { callbacks, listener, receive, roomAt } = setup();
    listener.connect(callbacks);

    receive(BROADCAST);
    await settle();

    expect(roomAt(0).access).toEqual({
      url: "wss://media.example.test/pinned",
      token: "listen-token",
    });
  });

  it("joins a broadcast that arrived before the media session connected", async () => {
    const { callbacks, listener, receive, rooms } = setup();

    receive(BROADCAST);
    await settle();
    expect(rooms).toHaveLength(0);

    listener.connect(callbacks);
    await settle();
    expect(rooms).toHaveLength(1);
  });

  it("stays in the room as the member walks between spaces", async () => {
    const { callbacks, listener, receive, rooms, steps } = setup();
    listener.connect(callbacks);
    receive(BROADCAST);
    await settle();

    const walked: ServerMessage[] = [
      { type: "spaceChanged", userId: ADMIN_ID, spaceKey: "library" },
      { type: "call", call: null },
    ];
    for (const message of walked) {
      listener.applyWorldMessage(message, presenceOf(BROADCAST));
    }
    listener.applyPresence(presenceOf(BROADCAST));
    await settle();

    expect(rooms).toHaveLength(1);
    expect(steps).toEqual(["join:listen-token"]);
  });

  it("hands over the admins' microphones it hears", async () => {
    const { callbacks, changes, listener, receive, roomAt } = setup();
    listener.connect(callbacks);
    receive(BROADCAST);
    await settle();

    const publication = adminMicrophone();
    roomAt(0).events.onRemotePublicationChange({
      publication,
      type: "upserted",
    });

    expect(changes).toEqual([{ publication, type: "upserted" }]);
  });

  it("leaves the old room before joining with a new token", async () => {
    const { callbacks, changes, listener, receive, roomAt, steps } = setup();
    listener.connect(callbacks);
    receive(BROADCAST);
    await settle();
    roomAt(0).events.onRemotePublicationChange({
      publication: adminMicrophone(),
      type: "upserted",
    });

    receive(broadcastWith("speak-token"));
    await settle();

    expect(steps).toEqual([
      "join:listen-token",
      "leave:listen-token",
      "join:speak-token",
    ]);
    expect(changes.at(-1)).toEqual({
      participantId: ADMIN_ID,
      publicationId: "admin-mic",
      source: "microphone",
      type: "removed",
    });
  });

  it("ignores what the old room says once a new token replaced it", async () => {
    const { callbacks, changes, listener, receive, roomAt, rooms } = setup();
    listener.connect(callbacks);
    receive(BROADCAST);
    await settle();
    const oldRoom = roomAt(0);

    receive(broadcastWith("speak-token"));
    await settle();
    oldRoom.events.onRemotePublicationChange({
      publication: adminMicrophone(),
      type: "upserted",
    });
    oldRoom.events.onDisconnected();
    await settle();

    expect(changes).toEqual([]);
    expect(rooms).toHaveLength(2);
    expect(roomAt(1).connection.disconnect).not.toHaveBeenCalled();
  });

  it("leaves the room and silences it on a null broadcast", async () => {
    const { callbacks, changes, listener, receive, roomAt } = setup();
    listener.connect(callbacks);
    receive(BROADCAST);
    await settle();
    roomAt(0).events.onRemotePublicationChange({
      publication: adminMicrophone(),
      type: "upserted",
    });

    receive(NO_BROADCAST);
    await settle();

    expect(roomAt(0).connection.disconnect).toHaveBeenCalledOnce();
    expect(changes.at(-1)).toMatchObject({ type: "removed" });
  });

  it("leaves when the socket closes and joins again on World's next broadcast", async () => {
    const { callbacks, changes, listener, receive, roomAt, steps } = setup();
    listener.connect(callbacks);
    receive(BROADCAST);
    await settle();
    roomAt(0).events.onRemotePublicationChange({
      publication: adminMicrophone(),
      type: "upserted",
    });

    listener.applyPresence(SOCKET_CLOSED);
    await settle();
    expect(roomAt(0).connection.disconnect).toHaveBeenCalledOnce();
    expect(changes.at(-1)).toMatchObject({ type: "removed" });

    receive(broadcastWith("fresh-token"));
    await settle();
    expect(steps).toEqual([
      "join:listen-token",
      "leave:listen-token",
      "join:fresh-token",
    ]);
  });

  it("a room that drops on its own clears what it carried and stays out", async () => {
    const { callbacks, changes, listener, receive, roomAt, rooms } = setup();
    listener.connect(callbacks);
    receive(BROADCAST);
    await settle();
    roomAt(0).events.onRemotePublicationChange({
      publication: adminMicrophone(),
      type: "upserted",
    });

    roomAt(0).events.onDisconnected();
    await settle();

    expect(changes.at(-1)).toMatchObject({ type: "removed" });
    expect(roomAt(0).connection.disconnect).toHaveBeenCalledOnce();
    expect(rooms).toHaveLength(1);
  });

  it("aborts a join that a newer broadcast overtook, and leaves what it returns", async () => {
    let releaseJoin = () => {};
    const held = new Promise<void>((resolve) => {
      releaseJoin = resolve;
    });
    let joins = 0;
    const { callbacks, listener, receive, roomAt, rooms } = setup({
      join: () => (joins++ === 0 ? held : Promise.resolve()),
    });
    listener.connect(callbacks);
    receive(BROADCAST);
    await settle();

    receive(broadcastWith("speak-token"));
    releaseJoin();
    await settle();

    expect(rooms).toHaveLength(1);
    expect(roomAt(0).access.token).toBe("speak-token");
  });

  it("never joins a room at a host it cannot pin", async () => {
    const { callbacks, listener, receive, rooms } = setup({
      pinMediaUrl: () => undefined,
    });
    listener.connect(callbacks);

    receive(BROADCAST);
    await settle();

    expect(rooms).toHaveLength(0);
  });

  it("a failed join leaves nothing behind for the next broadcast", async () => {
    let fail = true;
    const { callbacks, listener, receive, rooms } = setup({
      join: async () => {
        if (fail) throw new Error("server unreachable");
      },
    });
    listener.connect(callbacks);
    receive(BROADCAST);
    await settle();
    expect(rooms).toHaveLength(0);

    fail = false;
    receive(broadcastWith("fresh-token"));
    await settle();
    expect(rooms).toHaveLength(1);
  });

  it("leaves when the media session disconnects", async () => {
    const { callbacks, changes, listener, receive, roomAt } = setup();
    const disconnect = listener.connect(callbacks);
    receive(BROADCAST);
    await settle();
    roomAt(0).events.onRemotePublicationChange({
      publication: adminMicrophone(),
      type: "upserted",
    });

    disconnect();
    await settle();

    expect(roomAt(0).connection.disconnect).toHaveBeenCalledOnce();
    expect(changes.at(-1)).toMatchObject({ type: "removed" });
  });
});

describe("withBroadcastListener", () => {
  it("feeds both World's frames and closed presence, and shares one lifecycle", () => {
    const disconnectCall = vi.fn();
    const stopListening = vi.fn();
    const callMedia: CallMediaSession = {
      applyPresence: vi.fn(),
      applyWorldMessage: vi.fn(),
      connect: vi.fn(() => disconnectCall),
      handleLocalPublicationChange: vi.fn(),
      retry: vi.fn(),
      setVideoDemand: vi.fn(),
    };
    const broadcast = {
      applyPresence: vi.fn(),
      applyWorldMessage: vi.fn(),
      connect: vi.fn(() => stopListening),
    };
    const session = withBroadcastListener(callMedia, broadcast);
    const presence = presenceOf(BROADCAST);

    session.applyWorldMessage(BROADCAST, presence);
    session.applyPresence(SOCKET_CLOSED);
    const disconnect = session.connect({} as MeetingMediaTransportCallbacks);
    disconnect();

    expect(callMedia.applyWorldMessage).toHaveBeenCalledWith(
      BROADCAST,
      presence,
    );
    expect(broadcast.applyWorldMessage).toHaveBeenCalledWith(
      BROADCAST,
      presence,
    );
    expect(callMedia.applyPresence).toHaveBeenCalledWith(SOCKET_CLOSED);
    expect(broadcast.applyPresence).toHaveBeenCalledWith(SOCKET_CLOSED);
    expect(stopListening).toHaveBeenCalledOnce();
    expect(disconnectCall).toHaveBeenCalledOnce();
  });
});
