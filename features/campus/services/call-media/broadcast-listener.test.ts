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
  BroadcastSpeaking,
  LocalMediaPublication,
  LocalPublicationChange,
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
  SpaceCallMediaSession,
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

function speakingBroadcast(token = "speak-token"): BroadcastMessage {
  const message = broadcastWith(token);
  return { ...message, call: { ...message.call!, canSpeak: true } };
}

function ownMicrophone(deviceId = "mic-1"): LocalMediaPublication {
  const track = createTestMediaTrack("audio", deviceId);
  return {
    enabled: true,
    origin: "local",
    publicationId: `local-${deviceId}`,
    source: "microphone",
    stream: createTestMediaStream([track]),
    track,
  };
}

function microphoneAdded(
  publication = ownMicrophone(),
): LocalPublicationChange {
  return { publication, type: "added" };
}

function microphoneRemoved(
  publication = ownMicrophone(),
): LocalPublicationChange {
  return {
    previousTrack: publication.track,
    publicationId: publication.publicationId,
    source: "microphone",
    type: "removed",
  };
}
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
    refusePublish?: boolean;
  }> = {},
) {
  const rooms: Room[] = [];
  const steps: string[] = [];
  // What reached a room from the member: `<change>:<source or device>@<token>`.
  const sent: string[] = [];
  const roomTransport: BroadcastRoomTransport = {
    connect: vi.fn(async (access, events, signal) => {
      steps.push(`join:${access.token}`);
      await options.join?.();
      signal.throwIfAborted();
      const connection = {
        disconnect: vi.fn(async () => {
          steps.push(`leave:${access.token}`);
        }),
        handleLocalPublicationChange: vi.fn(
          async (change: LocalPublicationChange) => {
            const what =
              change.type === "removed"
                ? change.source
                : change.publication.publicationId.replace("local-", "");
            sent.push(`${change.type}:${what}@${access.token}`);
            if (options.refusePublish && change.type !== "removed") {
              throw new Error("publish refused");
            }
          },
        ),
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
  const speaking: BroadcastSpeaking[] = [];
  const callbacks = {
    onBroadcastPublicationChange: (change: BroadcastPublicationChange) =>
      changes.push(change),
    onBroadcastSpeakingChange: (next: BroadcastSpeaking) => speaking.push(next),
  };

  function receive(message: BroadcastMessage) {
    listener.applyWorldMessage(message, presenceOf(message));
  }

  function roomAt(index: number) {
    const room = rooms[index];
    if (!room) throw new Error(`No room joined at ${index}.`);
    return room;
  }

  return {
    callbacks,
    changes,
    listener,
    receive,
    roomAt,
    rooms,
    sent,
    speaking,
    steps,
  };
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

describe("speaking in a broadcast", () => {
  async function speakingAdmin(options: Parameters<typeof setup>[0] = {}) {
    const harness = setup(options);
    harness.listener.connect(harness.callbacks);
    harness.listener.handleLocalPublicationChange(microphoneAdded());
    harness.receive(speakingBroadcast());
    await settle();
    return harness;
  }

  it("publishes the member's microphone when they ask and World lets them", async () => {
    const { listener, sent, speaking } = await speakingAdmin();
    expect(sent).toEqual([]);

    listener.setSpeaking(true);
    await settle();

    expect(sent).toEqual(["added:mic-1@speak-token"]);
    expect(speaking).toEqual(["on"]);
  });

  it("never publishes a camera or a screen", async () => {
    const { listener, sent } = await speakingAdmin();
    listener.setSpeaking(true);
    const camera = { ...ownMicrophone("cam-1"), source: "camera" as const };

    listener.handleLocalPublicationChange({
      publication: camera,
      type: "added",
    });
    listener.handleLocalPublicationChange({
      publication: { ...camera, source: "screen" },
      type: "added",
    });
    await settle();

    expect(sent).toEqual(["added:mic-1@speak-token"]);
  });

  it("publishes nothing for a member World lets only listen", async () => {
    const { callbacks, listener, receive, sent, speaking } = setup();
    listener.connect(callbacks);
    listener.handleLocalPublicationChange(microphoneAdded());
    receive(BROADCAST);
    await settle();

    listener.setSpeaking(true);
    await settle();

    expect(sent).toEqual([]);
    expect(speaking).toEqual([]);
  });

  it("follows a device switch, and stops", async () => {
    const { listener, sent, speaking } = await speakingAdmin();
    listener.setSpeaking(true);

    listener.handleLocalPublicationChange({
      previousTrack: ownMicrophone().track,
      publication: ownMicrophone("mic-2"),
      type: "replaced",
    });
    listener.setSpeaking(false);
    await settle();

    expect(sent).toEqual([
      "added:mic-1@speak-token",
      "replaced:mic-2@speak-token",
      "removed:microphone@speak-token",
    ]);
    expect(speaking).toEqual(["on", "off"]);
  });

  it("ends the broadcast when the member turns the microphone off", async () => {
    const { listener, sent, speaking } = await speakingAdmin();
    listener.setSpeaking(true);

    listener.handleLocalPublicationChange(microphoneRemoved());
    listener.handleLocalPublicationChange(microphoneAdded());
    await settle();

    expect(sent).toEqual([
      "added:mic-1@speak-token",
      "removed:microphone@speak-token",
    ]);
    expect(speaking).toEqual(["on", "off"]);
  });

  it("a device switch while not speaking sends nothing", async () => {
    const { listener, sent } = await speakingAdmin();

    listener.handleLocalPublicationChange({
      previousTrack: ownMicrophone().track,
      publication: ownMicrophone("mic-2"),
      type: "replaced",
    });
    await settle();

    expect(sent).toEqual([]);
  });

  it("stops, and stays stopped, once World says the member may no longer speak", async () => {
    const { listener, receive, sent, speaking, steps } = await speakingAdmin();
    listener.setSpeaking(true);
    await settle();

    receive(broadcastWith("listen-token"));
    await settle();

    expect(speaking).toEqual(["on", "off"]);
    expect(steps).toEqual([
      "join:speak-token",
      "leave:speak-token",
      "join:listen-token",
    ]);
    expect(sent).toEqual(["added:mic-1@speak-token"]);
  });

  it("carries on with a fresh token that may still speak", async () => {
    const { listener, receive, sent, speaking } = await speakingAdmin();
    listener.setSpeaking(true);
    await settle();

    receive(speakingBroadcast("fresh-token"));
    await settle();

    expect(sent).toEqual([
      "added:mic-1@speak-token",
      "added:mic-1@fresh-token",
    ]);
    expect(speaking).toEqual(["on"]);
  });

  it("publishes as soon as a room asked for before it joined is in", async () => {
    let releaseJoin = () => {};
    const held = new Promise<void>((resolve) => {
      releaseJoin = resolve;
    });
    const { callbacks, listener, receive, sent } = setup({ join: () => held });
    listener.connect(callbacks);
    listener.handleLocalPublicationChange(microphoneAdded());
    receive(speakingBroadcast());
    await settle();

    listener.setSpeaking(true);
    expect(sent).toEqual([]);
    releaseJoin();
    await settle();

    expect(sent).toEqual(["added:mic-1@speak-token"]);
  });

  it("reports a refused microphone and lets the member try again", async () => {
    const { listener, speaking } = await speakingAdmin({
      refusePublish: true,
    });

    listener.setSpeaking(true);
    await settle();
    expect(speaking).toEqual(["on", "failed"]);

    listener.setSpeaking(true);
    await settle();
    expect(speaking).toEqual(["on", "failed", "on", "failed"]);
  });

  it.each([
    [
      "a null broadcast",
      (harness: Awaited<ReturnType<typeof setup>>) =>
        harness.receive(NO_BROADCAST),
    ],
    [
      "a closed socket",
      (harness: Awaited<ReturnType<typeof setup>>) =>
        harness.listener.applyPresence(SOCKET_CLOSED),
    ],
  ])("ends the broadcast on %s", async (_case, end) => {
    const harness = await speakingAdmin();
    harness.listener.setSpeaking(true);
    await settle();

    end(harness);
    await settle();

    expect(harness.speaking).toEqual(["on", "off"]);
    expect(harness.roomAt(0).connection.disconnect).toHaveBeenCalledOnce();
  });

  it("fails the broadcast when its room drops, and refuses to start without one", async () => {
    const { listener, roomAt, rooms, sent, speaking } = await speakingAdmin();
    listener.setSpeaking(true);
    await settle();

    roomAt(0).events.onDisconnected();
    await settle();
    expect(speaking).toEqual(["on", "failed"]);

    listener.setSpeaking(true);
    await settle();
    expect(speaking).toEqual(["on", "failed"]);
    expect(sent).toEqual(["added:mic-1@speak-token"]);
    expect(rooms).toHaveLength(1);
  });

  it("speaks again once World's next broadcast joins a room", async () => {
    const { listener, receive, roomAt, sent, speaking } = await speakingAdmin();
    listener.setSpeaking(true);
    await settle();
    roomAt(0).events.onDisconnected();
    await settle();

    receive(speakingBroadcast("fresh-token"));
    listener.setSpeaking(true);
    await settle();

    expect(speaking).toEqual(["on", "failed", "on"]);
    expect(sent).toEqual([
      "added:mic-1@speak-token",
      "added:mic-1@fresh-token",
    ]);
  });

  it("fails the broadcast when a fresh token's room cannot be joined", async () => {
    let fail = false;
    const { listener, receive, speaking } = await speakingAdmin({
      join: async () => {
        if (fail) throw new Error("server unreachable");
      },
    });
    listener.setSpeaking(true);
    await settle();

    fail = true;
    receive(speakingBroadcast("fresh-token"));
    await settle();

    expect(speaking).toEqual(["on", "failed"]);
  });

  it("fails the broadcast when a fresh token's host cannot be pinned", async () => {
    const { listener, receive, speaking } = await speakingAdmin({
      pinMediaUrl: (url) => (url.includes("unknown") ? undefined : url),
    });
    listener.setSpeaking(true);
    await settle();

    const fresh = speakingBroadcast("fresh-token");
    if (!fresh.call) throw new Error("A speaking broadcast carries a call.");
    receive({ ...fresh, call: { ...fresh.call, url: "wss://unknown.test" } });
    await settle();

    expect(speaking).toEqual(["on", "failed"]);
  });

  it("reports nothing when a room is lost while the member is not speaking", async () => {
    const { roomAt, speaking } = await speakingAdmin();

    roomAt(0).events.onDisconnected();
    await settle();

    expect(speaking).toEqual([]);
  });

  it("ends the broadcast when the media session disconnects", async () => {
    const harness = setup();
    const disconnect = harness.listener.connect(harness.callbacks);
    harness.listener.handleLocalPublicationChange(microphoneAdded());
    harness.receive(speakingBroadcast());
    await settle();
    harness.listener.setSpeaking(true);

    disconnect();

    expect(harness.speaking).toEqual(["on", "off"]);
  });
});

describe("withBroadcastListener", () => {
  it("feeds both World's frames and closed presence, and shares one lifecycle", () => {
    const disconnectCall = vi.fn();
    const stopListening = vi.fn();
    const callMedia: SpaceCallMediaSession = {
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
      handleLocalPublicationChange: vi.fn(),
      setSpeaking: vi.fn(),
    };
    const session = withBroadcastListener(callMedia, broadcast);
    const presence = presenceOf(BROADCAST);

    session.applyWorldMessage(BROADCAST, presence);
    session.applyPresence(SOCKET_CLOSED);
    const disconnect = session.connect({} as MeetingMediaTransportCallbacks);
    session.handleLocalPublicationChange(microphoneAdded());
    session.setBroadcastSpeaking(true);
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
    expect(callMedia.handleLocalPublicationChange).toHaveBeenCalledOnce();
    expect(broadcast.handleLocalPublicationChange).toHaveBeenCalledOnce();
    expect(broadcast.setSpeaking).toHaveBeenCalledExactlyOnceWith(true);
    expect(stopListening).toHaveBeenCalledOnce();
    expect(disconnectCall).toHaveBeenCalledOnce();
  });
});
