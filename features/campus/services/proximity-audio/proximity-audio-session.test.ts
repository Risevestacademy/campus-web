import { describe, expect, it, vi } from "vitest";

import type { Presence } from "@/core/presence";
import type { CallMessage, ServerMessage } from "@/core/realtime";

import {
  createTestMediaStream,
  createTestMediaTrack,
} from "../../testing/media-session-test-utils";
import type {
  LocalMediaPublication,
  LocalPublicationChange,
  RemoteMediaPublication,
} from "../media-session/contracts";
import type {
  MeetingRoomConnection,
  MeetingRoomEvents,
  MeetingRoomTransport,
} from "./contracts";
import { createProximityAudioSession } from "./proximity-audio-session";

const SELF_ID = "11111111-1111-4111-8111-111111111111";
const NEARBY_ID = "22222222-2222-4222-8222-222222222222";
const UNKNOWN_ID = "33333333-3333-4333-8333-333333333333";
const TOKEN = "room-token";

const NEARBY: Extract<ServerMessage, { type: "nearby" }> = {
  type: "nearby",
  userIds: [NEARBY_ID],
};
const CALL: CallMessage = {
  type: "call",
  call: {
    url: "wss://media.example.test",
    token: TOKEN,
    hearing: "proximity",
    audibleRadius: 6,
  },
};
const NO_CALL: CallMessage = { type: "call", call: null };
const PEER_MOVED_AWAY: ServerMessage = {
  type: "moved",
  players: [{ userId: NEARBY_ID, x: 7, y: 1, facing: "left" }],
};
const NOBODY_NEARBY: ServerMessage = { type: "nearby", userIds: [] };

function callWith(overrides: Partial<NonNullable<CallMessage["call"]>>) {
  return { ...CALL, call: { ...CALL.call!, ...overrides } };
}

function presenceWith(nearby: readonly string[]): Presence {
  return {
    selfId: SELF_ID,
    map: { id: "map", version: "v1", width: 10, height: 10 },
    participants: new Map([
      [SELF_ID, { userId: SELF_ID, displayName: "Ada", spriteKey: null }],
      [NEARBY_ID, { userId: NEARBY_ID, displayName: "Grace", spriteKey: null }],
    ]),
    positions: new Map([
      [SELF_ID, { x: 1, y: 1, facing: "right" }],
      [NEARBY_ID, { x: 4, y: 1, facing: "left" }],
    ]),
    nearby,
    encounter: nearby.length > 0 ? 1 : 0,
  };
}

function withoutPosition(presence: Presence, userId: string): Presence {
  const positions = new Map(presence.positions);
  positions.delete(userId);
  return { ...presence, positions };
}

function createConnection(): MeetingRoomConnection {
  return {
    disconnect: vi.fn().mockResolvedValue(undefined),
    handleLocalPublicationChange: vi.fn().mockResolvedValue(undefined),
    setSubscribedParticipantIds: vi.fn(),
  };
}

type Room = Readonly<{
  connection: MeetingRoomConnection;
  events: MeetingRoomEvents;
  signal: AbortSignal;
}>;

function setup(
  options: Readonly<{
    connectLater?: boolean;
    join?: () => Promise<void>;
    now?: () => number;
    pinMediaUrl?: (url: string) => string | undefined;
  }> = {},
) {
  const rooms: Room[] = [];
  const joinSignals: AbortSignal[] = [];
  const steps: string[] = [];
  const roomTransport: MeetingRoomTransport = {
    connect: vi.fn(async (_access, events, signal) => {
      steps.push("join");
      joinSignals.push(signal);
      await options.join?.();
      const connection: MeetingRoomConnection = {
        ...createConnection(),
        disconnect: vi.fn(async () => {
          steps.push("leave");
        }),
      };
      rooms.push({ connection, events, signal });
      return connection;
    }),
  };
  const callbacks = {
    onRemoteAudioGainsChange: vi.fn(),
    onRemotePublicationChange: vi.fn(),
    onStatusChange: vi.fn(),
  };
  const recordFirstAudioMilliseconds = vi.fn();
  const session = createProximityAudioSession({
    now: options.now ?? (() => 0),
    pinMediaUrl: options.pinMediaUrl ?? ((url) => url),
    recordFirstAudioMilliseconds,
    roomTransport,
  });
  if (!options.connectLater) session.connect(callbacks);

  function roomAt(index: number) {
    const room = rooms[index];
    if (!room) throw new Error(`room ${index} never joined`);
    return room;
  }

  async function joined(count = 1) {
    await vi.waitFor(() => {
      expect(rooms).toHaveLength(count);
      expect(callbacks.onStatusChange).toHaveBeenLastCalledWith("connected");
    });
    return roomAt(count - 1);
  }

  return {
    callbacks,
    joined,
    joinSignals,
    recordFirstAudioMilliseconds,
    roomAt,
    roomTransport,
    session,
    steps,
  };
}

function localPublication(
  source: "camera" | "microphone",
): LocalMediaPublication {
  const track = createTestMediaTrack(
    source === "camera" ? "video" : "audio",
    `${source}-1`,
  );
  return {
    enabled: true,
    origin: "local",
    publicationId: `local-${source}`,
    source,
    stream: createTestMediaStream([track]),
    track,
  };
}

function remoteMicrophone(): RemoteMediaPublication {
  const track = createTestMediaTrack("audio", "remote-microphone-1");
  return {
    enabled: true,
    origin: "remote",
    participantId: NEARBY_ID,
    publicationId: "remote-microphone",
    source: "microphone",
    stream: createTestMediaStream([track]),
    track,
  };
}

describe("createProximityAudioSession", () => {
  it("subscribes only known peers from nearby membership that arrived before the call", async () => {
    const { joined, session } = setup();
    const presence = presenceWith([SELF_ID, UNKNOWN_ID, NEARBY_ID]);

    session.applyWorldMessage(NEARBY, presence);
    session.applyWorldMessage(CALL, presence);

    const { connection } = await joined();
    expect(connection.setSubscribedParticipantIds).toHaveBeenCalledWith(
      new Set([NEARBY_ID]),
    );
  });

  it("disconnects the active room when World sends a null call", async () => {
    const { callbacks, joined, session } = setup();
    const presence = presenceWith([NEARBY_ID]);
    session.applyWorldMessage(CALL, presence);
    const { connection } = await joined();

    session.applyWorldMessage(NO_CALL, presence);

    await vi.waitFor(() =>
      expect(connection.disconnect).toHaveBeenCalledOnce(),
    );
    expect(callbacks.onStatusChange).toHaveBeenLastCalledWith("idle");
  });

  it("joins a call that arrived before the media session connected", async () => {
    const { callbacks, joined, session } = setup({ connectLater: true });
    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
    await new Promise((resolve) => setTimeout(resolve, 0));

    session.connect(callbacks);

    const { connection } = await joined();
    expect(connection.setSubscribedParticipantIds).toHaveBeenCalledWith(
      new Set([NEARBY_ID]),
    );
  });

  it("rejoins World's latest call when the media session connects again", async () => {
    const { callbacks, joined, roomTransport, session } = setup({
      connectLater: true,
    });
    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
    const disconnect = session.connect(callbacks);
    const first = await joined();
    disconnect();
    await vi.waitFor(() =>
      expect(first.connection.disconnect).toHaveBeenCalledOnce(),
    );

    session.connect(callbacks);

    await joined(2);
    expect(roomTransport.connect).toHaveBeenLastCalledWith(
      { url: CALL.call!.url, token: TOKEN },
      expect.anything(),
      expect.any(AbortSignal),
    );
  });

  it("releases remote audio when the media session disconnects", async () => {
    const { callbacks, joined, session } = setup({ connectLater: true });
    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
    const disconnect = session.connect(callbacks);
    const room = await joined();
    const publication = remoteMicrophone();
    room.events.onRemotePublicationChange({ publication, type: "upserted" });

    disconnect();

    expect(callbacks.onRemotePublicationChange).toHaveBeenLastCalledWith({
      participantId: NEARBY_ID,
      publicationId: publication.publicationId,
      source: "microphone",
      type: "removed",
    });
    expect(callbacks.onRemoteAudioGainsChange).toHaveBeenLastCalledWith({});
    await vi.waitFor(() =>
      expect(room.connection.disconnect).toHaveBeenCalledOnce(),
    );
  });

  it.each([
    [
      "a room-hearing call",
      callWith({ hearing: "room" }),
      (url: string) => url,
      "idle",
    ],
    ["an unpinned media host", CALL, () => undefined, "unavailable"],
  ] as const)(
    "never joins for %s",
    async (_case, message, pinMediaUrl, status) => {
      const { callbacks, roomTransport, session } = setup({ pinMediaUrl });

      session.applyWorldMessage(message, presenceWith([NEARBY_ID]));

      await vi.waitFor(() =>
        expect(callbacks.onStatusChange).toHaveBeenLastCalledWith(status),
      );
      expect(roomTransport.connect).not.toHaveBeenCalled();
    },
  );

  it("reports connecting, then connected before the first gains", async () => {
    const { callbacks, joined, session } = setup();

    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));

    await joined();
    expect(callbacks.onStatusChange.mock.calls).toEqual([
      ["connecting"],
      ["connected"],
    ]);
    const firstGains = callbacks.onRemoteAudioGainsChange.mock.calls.findIndex(
      ([gains]) => NEARBY_ID in gains,
    );
    expect(callbacks.onStatusChange.mock.invocationCallOrder[1]).toBeLessThan(
      callbacks.onRemoteAudioGainsChange.mock.invocationCallOrder[firstGains]!,
    );
  });

  it("becomes unavailable and silent when the room fails to join", async () => {
    const { callbacks, session } = setup({
      join: () => Promise.reject(new Error("join failed")),
    });

    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));

    await vi.waitFor(() =>
      expect(callbacks.onStatusChange).toHaveBeenLastCalledWith("unavailable"),
    );
    expect(callbacks.onRemoteAudioGainsChange).toHaveBeenLastCalledWith({});
  });

  it("emits linear gain from authoritative tile positions", async () => {
    const { callbacks, joined, session } = setup();

    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));

    await joined();
    expect(callbacks.onRemoteAudioGainsChange).toHaveBeenLastCalledWith({
      [NEARBY_ID]: 0.5,
    });
  });

  it.each([
    [
      "their own position is unknown",
      withoutPosition(presenceWith([NEARBY_ID]), SELF_ID),
      6,
    ],
    [
      "the peer's position is unknown",
      withoutPosition(presenceWith([NEARBY_ID]), NEARBY_ID),
      6,
    ],
    ["the audible radius is zero", presenceWith([NEARBY_ID]), 0],
  ] as const)(
    "keeps a nearby peer silent when %s",
    async (_case, presence, audibleRadius) => {
      const { callbacks, joined, session } = setup();

      session.applyWorldMessage(callWith({ audibleRadius }), presence);

      await joined();
      expect(callbacks.onRemoteAudioGainsChange).toHaveBeenLastCalledWith({
        [NEARBY_ID]: 0,
      });
    },
  );

  it.each([
    [
      "an authoritative movement",
      PEER_MOVED_AWAY,
      (presence: Presence): Presence => ({
        ...presence,
        positions: new Map(presence.positions).set(NEARBY_ID, {
          x: 7,
          y: 1,
          facing: "left",
        }),
      }),
      new Set([NEARBY_ID]),
      { [NEARBY_ID]: 0 },
    ],
    [
      "a nearby change",
      NOBODY_NEARBY,
      (presence: Presence): Presence => ({ ...presence, nearby: [] }),
      new Set(),
      {},
    ],
  ] as const)(
    "updates subscriptions and gain in the same task as %s",
    async (_case, message, apply, participantIds, gains) => {
      const { callbacks, joined, session } = setup();
      const presence = presenceWith([NEARBY_ID]);
      session.applyWorldMessage(CALL, presence);
      const { connection } = await joined();

      session.applyWorldMessage(message, apply(presence));

      expect(connection.setSubscribedParticipantIds).toHaveBeenLastCalledWith(
        participantIds,
      );
      expect(callbacks.onRemoteAudioGainsChange).toHaveBeenLastCalledWith(
        gains,
      );
    },
  );

  it("disconnects the old room before joining the replacement", async () => {
    const { joined, session, steps } = setup();
    const presence = presenceWith([NEARBY_ID]);
    session.applyWorldMessage(CALL, presence);
    await joined();

    session.applyWorldMessage(callWith({ token: "new-token" }), presence);

    await joined(2);
    expect(steps).toEqual(["join", "leave", "join"]);
  });

  it.each([
    ["a replacement call", callWith({ token: "new-token" })],
    ["a null call", NO_CALL],
  ] as const)(
    "drops a pending join when %s arrives first",
    async (_case, next) => {
      const pending = Promise.withResolvers<void>();
      const { joinSignals, roomAt, session } = setup({
        join: () => pending.promise,
      });
      const presence = presenceWith([NEARBY_ID]);
      session.applyWorldMessage(CALL, presence);
      await vi.waitFor(() => expect(joinSignals).toHaveLength(1));

      session.applyWorldMessage(next, presence);
      pending.resolve();

      await vi.waitFor(() =>
        expect(roomAt(0).connection.disconnect).toHaveBeenCalledOnce(),
      );
      expect(joinSignals[0]?.aborted).toBe(true);
      expect(
        roomAt(0).connection.setSubscribedParticipantIds,
      ).not.toHaveBeenCalled();
    },
  );

  it("replays an enabled microphone chosen before the room connects", async () => {
    const { joined, session } = setup();
    const publication = localPublication("microphone");
    session.handleLocalPublicationChange({ publication, type: "added" });

    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));

    const { connection } = await joined();
    expect(connection.handleLocalPublicationChange).toHaveBeenCalledWith({
      publication,
      type: "added",
    });
  });

  it.each([
    [
      "a new microphone",
      (): LocalPublicationChange => ({
        publication: localPublication("microphone"),
        type: "added",
      }),
    ],
    [
      "a replaced microphone device",
      (): LocalPublicationChange => ({
        previousTrack: createTestMediaTrack("audio", "microphone-0"),
        publication: localPublication("microphone"),
        type: "replaced",
      }),
    ],
  ] as const)(
    "becomes unavailable when the room rejects %s",
    async (_case, change) => {
      const { callbacks, joined, session } = setup();
      session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
      const { connection } = await joined();
      vi.mocked(connection.handleLocalPublicationChange).mockRejectedValueOnce(
        new Error("publish failed"),
      );

      session.handleLocalPublicationChange(change());

      await vi.waitFor(() =>
        expect(callbacks.onStatusChange).toHaveBeenLastCalledWith(
          "unavailable",
        ),
      );
      expect(connection.disconnect).toHaveBeenCalledOnce();
    },
  );

  it("never publishes the camera to the room", async () => {
    const { joined, session } = setup();
    session.handleLocalPublicationChange({
      publication: localPublication("camera"),
      type: "added",
    });
    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
    const { connection } = await joined();

    session.handleLocalPublicationChange({
      publication: localPublication("camera"),
      type: "added",
    });

    expect(connection.handleLocalPublicationChange).not.toHaveBeenCalled();
  });

  it.each([
    [
      "World ends the call",
      (room: Room, session: ReturnType<typeof setup>["session"]) =>
        session.applyWorldMessage(NO_CALL, presenceWith([NEARBY_ID])),
      "idle",
    ],
    [
      "World moves to a room-hearing space",
      (room: Room, session: ReturnType<typeof setup>["session"]) =>
        session.applyWorldMessage(
          callWith({ hearing: "room" }),
          presenceWith([NEARBY_ID]),
        ),
      "idle",
    ],
    [
      "the room disconnects on its own",
      (room: Room) => room.events.onDisconnected(),
      "unavailable",
    ],
  ] as const)("clears remote audio when %s", async (_case, end, status) => {
    const { callbacks, joined, session } = setup();
    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
    const room = await joined();
    const publication = remoteMicrophone();
    room.events.onRemotePublicationChange({ publication, type: "upserted" });

    end(room, session);

    await vi.waitFor(() =>
      expect(callbacks.onStatusChange).toHaveBeenLastCalledWith(status),
    );
    expect(callbacks.onRemotePublicationChange).toHaveBeenLastCalledWith({
      participantId: NEARBY_ID,
      publicationId: publication.publicationId,
      source: "microphone",
      type: "removed",
    });
    expect(callbacks.onRemoteAudioGainsChange).toHaveBeenLastCalledWith({});
    await vi.waitFor(() =>
      expect(room.connection.disconnect).toHaveBeenCalledOnce(),
    );
  });

  it("ignores publications from a room it already left", async () => {
    const { callbacks, joined, session } = setup();
    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
    const room = await joined();
    session.applyWorldMessage(NO_CALL, presenceWith([NEARBY_ID]));
    await vi.waitFor(() =>
      expect(room.connection.disconnect).toHaveBeenCalled(),
    );

    room.events.onRemotePublicationChange({
      publication: remoteMicrophone(),
      type: "upserted",
    });

    expect(callbacks.onRemotePublicationChange).not.toHaveBeenCalled();
  });

  it("measures first remote audio from call receipt once per call", async () => {
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValue(250);
    const { joined, recordFirstAudioMilliseconds, session } = setup({ now });
    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
    const room = await joined();

    room.events.onFirstRemoteAudio();
    room.events.onFirstRemoteAudio();

    expect(recordFirstAudioMilliseconds).toHaveBeenCalledExactlyOnceWith(150);
  });

  it("does not measure a call that arrived with nobody nearby", async () => {
    const { joined, recordFirstAudioMilliseconds, session } = setup();
    session.applyWorldMessage(CALL, presenceWith([]));
    const room = await joined();

    room.events.onFirstRemoteAudio();

    expect(recordFirstAudioMilliseconds).not.toHaveBeenCalled();
  });

  it("keeps the room token out of every callback", async () => {
    const { callbacks, joined, session } = setup();
    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
    const room = await joined();
    room.events.onRemotePublicationChange({
      publication: remoteMicrophone(),
      type: "upserted",
    });
    room.events.onDisconnected();

    const emitted = JSON.stringify(
      Object.values(callbacks).flatMap((callback) => callback.mock.calls),
    );

    expect(emitted).not.toContain(TOKEN);
  });
});
