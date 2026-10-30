import { afterEach, describe, expect, it, vi } from "vitest";

import type { Hearing, Presence } from "@/core/presence";
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
import { createCallMediaSession } from "./call-media-session";
import {
  type MeetingRoomConnection,
  type MeetingRoomEvents,
  type MeetingRoomTransport,
  RoomAccessDeniedError,
} from "./contracts";

const SELF_ID = "11111111-1111-4111-8111-111111111111";
const NEARBY_ID = "22222222-2222-4222-8222-222222222222";
const STRANGER_ID = "33333333-3333-4333-8333-333333333333";
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

function presenceWith(
  meetingRoster: readonly string[],
  hearing: Hearing = "proximity",
): Presence {
  return {
    selfId: SELF_ID,
    map: { id: "map", version: "v1", width: 10, height: 10 },
    synced: true,
    participants: new Map([
      [
        SELF_ID,
        {
          userId: SELF_ID,
          displayName: "Ada",
          spriteKey: null,
          status: "available" as const,
          spaceKey: "_default",
        },
      ],
      [
        NEARBY_ID,
        {
          userId: NEARBY_ID,
          displayName: "Grace",
          spriteKey: null,
          status: "available" as const,
          spaceKey: "_default",
        },
      ],
    ]),
    positions: new Map([
      [SELF_ID, { x: 1, y: 1, facing: "right" }],
      [NEARBY_ID, { x: 4, y: 1, facing: "left" }],
    ]),
    spaceNames: new Map(),
    nearby: hearing === "proximity" ? meetingRoster : [],
    hearing,
    meetingRoster,
    encounter: meetingRoster.length > 0 ? 1 : 0,
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
    applyAudience: vi.fn(),
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
  const recordFirstVideo = vi.fn();
  const refreshCall = vi.fn(() => true);
  const session = createCallMediaSession({
    now: options.now ?? (() => 0),
    pinMediaUrl: options.pinMediaUrl ?? ((url) => url),
    recordFirstAudioMilliseconds,
    recordFirstVideo,
    refreshCall,
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
    recordFirstVideo,
    refreshCall,
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

describe("createCallMediaSession", () => {
  it.each([
    ["room", 1],
    ["proximity", 0.5],
  ] as const)(
    "subscribes the meeting roster of a %s call that arrived before it, at gain %d",
    async (hearing, gain) => {
      const { callbacks, joined, session } = setup();
      const presence = presenceWith([NEARBY_ID], hearing);

      session.applyWorldMessage(NEARBY, presence);
      session.applyWorldMessage(callWith({ hearing }), presence);

      const { connection } = await joined();
      expect(connection.applyAudience).toHaveBeenCalledWith(
        expect.objectContaining({
          participantIds: new Set([NEARBY_ID]),
        }),
      );
      expect(callbacks.onRemoteAudioGainsChange).toHaveBeenLastCalledWith({
        [NEARBY_ID]: gain,
      });
    },
  );

  it("unsubscribes a room mate who steps out, in the same task", async () => {
    const { callbacks, joined, session } = setup();
    session.applyWorldMessage(
      callWith({ hearing: "room" }),
      presenceWith([NEARBY_ID], "room"),
    );
    const { connection } = await joined();

    session.applyWorldMessage(
      { type: "spaceChanged", userId: NEARBY_ID, spaceKey: "_default" },
      presenceWith([], "room"),
    );

    expect(connection.applyAudience).toHaveBeenLastCalledWith(
      expect.objectContaining({
        participantIds: new Set(),
      }),
    );
    expect(callbacks.onRemoteAudioGainsChange).toHaveBeenLastCalledWith({});
  });

  it("unsubscribes everyone and silences them when presence loses them", async () => {
    const { callbacks, joined, session } = setup();
    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
    const { connection } = await joined();

    session.applyPresence(presenceWith([]));

    expect(connection.applyAudience).toHaveBeenLastCalledWith(
      expect.objectContaining({
        participantIds: new Set(),
      }),
    );
    expect(callbacks.onRemoteAudioGainsChange).toHaveBeenLastCalledWith({});
  });

  it("joins a call that arrived before the media session connected", async () => {
    const { callbacks, joined, session } = setup({ connectLater: true });
    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
    await new Promise((resolve) => setTimeout(resolve, 0));

    session.connect(callbacks);

    const { connection } = await joined();
    expect(connection.applyAudience).toHaveBeenCalledWith(
      expect.objectContaining({
        participantIds: new Set([NEARBY_ID]),
      }),
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
      "a hearing World added later",
      callWith({ hearing: "unknown" }),
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

  describe("trying again", () => {
    async function unavailableAfter(firstFailure: Error, retryFailure?: Error) {
      const join = vi
        .fn<() => Promise<void>>()
        .mockRejectedValueOnce(firstFailure);
      if (retryFailure) join.mockRejectedValueOnce(retryFailure);
      const room = setup({ join });
      room.session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
      await vi.waitFor(() =>
        expect(room.callbacks.onStatusChange).toHaveBeenLastCalledWith(
          "unavailable",
        ),
      );
      return room;
    }

    it("rejoins the latest call in place", async () => {
      const { joined, roomTransport, session } = await unavailableAfter(
        new Error("server unreachable"),
      );

      session.retry();

      await joined();
      expect(roomTransport.connect).toHaveBeenLastCalledWith(
        { url: CALL.call?.url, token: TOKEN },
        expect.anything(),
        expect.anything(),
      );
    });

    it("asks World for a fresh call when the retried grant was refused", async () => {
      const { callbacks, refreshCall, session } = await unavailableAfter(
        new Error("server unreachable"),
        new RoomAccessDeniedError("token expired"),
      );

      session.retry();

      await vi.waitFor(() => expect(refreshCall).toHaveBeenCalledOnce());
      expect(callbacks.onStatusChange).toHaveBeenLastCalledWith("connecting");
    });

    it("becomes unavailable when World cannot refresh the call", async () => {
      const { callbacks, refreshCall, session } = await unavailableAfter(
        new Error("server unreachable"),
        new RoomAccessDeniedError("token expired"),
      );
      refreshCall.mockReturnValue(false);
      callbacks.onStatusChange.mockClear();

      session.retry();

      await vi.waitFor(() =>
        expect(callbacks.onStatusChange).toHaveBeenLastCalledWith(
          "unavailable",
        ),
      );
      expect(refreshCall).toHaveBeenCalledOnce();
    });

    describe("while World sends a fresh call", () => {
      afterEach(() => {
        vi.useRealTimers();
      });

      async function refreshing() {
        const room = await unavailableAfter(
          new Error("server unreachable"),
          new RoomAccessDeniedError("token expired"),
        );
        vi.useFakeTimers();
        room.session.retry();
        await vi.waitFor(() => expect(room.refreshCall).toHaveBeenCalledOnce());
        return room;
      }

      it("gives up after 15 seconds without one", async () => {
        const { callbacks } = await refreshing();

        await vi.advanceTimersByTimeAsync(14_000);
        expect(callbacks.onStatusChange).toHaveBeenLastCalledWith("connecting");
        await vi.advanceTimersByTimeAsync(1_000);

        expect(callbacks.onStatusChange).toHaveBeenLastCalledWith(
          "unavailable",
        );
      });

      it("keeps the fresh call that arrives in time", async () => {
        const { callbacks, joined, session } = await refreshing();
        session.applyWorldMessage(
          callWith({ token: "fresh-token" }),
          presenceWith([NEARBY_ID]),
        );
        await joined();

        await vi.advanceTimersByTimeAsync(15_000);

        expect(callbacks.onStatusChange).toHaveBeenLastCalledWith("connected");
      });
    });

    it("never measures first audio for a retry", async () => {
      const { joined, recordFirstAudioMilliseconds, session } =
        await unavailableAfter(new Error("server unreachable"));

      session.retry();
      const room = await joined();
      room.events.onFirstRemoteAudio();

      expect(recordFirstAudioMilliseconds).not.toHaveBeenCalled();
    });

    it("stays unavailable when the retry fails for another reason", async () => {
      const { callbacks, refreshCall, session } = await unavailableAfter(
        new Error("server unreachable"),
        new Error("still unreachable"),
      );
      callbacks.onStatusChange.mockClear();

      session.retry();

      await vi.waitFor(() =>
        expect(callbacks.onStatusChange).toHaveBeenLastCalledWith(
          "unavailable",
        ),
      );
      expect(refreshCall).not.toHaveBeenCalled();
    });

    it("never asks World for a fresh call without the member trying again", async () => {
      const { refreshCall } = await unavailableAfter(
        new RoomAccessDeniedError("token expired"),
      );

      expect(refreshCall).not.toHaveBeenCalled();
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
      (presence: Presence): Presence => ({
        ...presence,
        nearby: [],
        meetingRoster: [],
      }),
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

      expect(connection.applyAudience).toHaveBeenLastCalledWith(
        expect.objectContaining({
          participantIds,
        }),
      );
      expect(callbacks.onRemoteAudioGainsChange).toHaveBeenLastCalledWith(
        gains,
      );
    },
  );

  it("asks only for the cameras on screen of whoever the member meets", async () => {
    const { joined, session } = setup();
    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
    const { connection } = await joined();

    session.setVideoDemand(
      new Map([
        [NEARBY_ID, "high"],
        [STRANGER_ID, "low"],
      ]),
    );

    expect(connection.applyAudience).toHaveBeenLastCalledWith({
      participantIds: new Set([NEARBY_ID]),
      video: new Map([[NEARBY_ID, "high"]]),
    });
  });

  it("asks for the cameras on screen as soon as a room joins", async () => {
    const { joined, session } = setup();
    session.setVideoDemand(new Map([[NEARBY_ID, "low"]]));

    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));

    const { connection } = await joined();
    expect(connection.applyAudience).toHaveBeenCalledWith({
      participantIds: new Set([NEARBY_ID]),
      video: new Map([[NEARBY_ID, "low"]]),
    });
  });

  it("drops every camera in the same task as a crossing empties the roster", async () => {
    const { joined, session } = setup();
    session.setVideoDemand(new Map([[NEARBY_ID, "low"]]));
    session.applyWorldMessage(
      callWith({ hearing: "room" }),
      presenceWith([NEARBY_ID], "room"),
    );
    const { connection } = await joined();

    session.applyWorldMessage(
      { type: "spaceChanged", userId: SELF_ID, spaceKey: "library" },
      { ...presenceWith([]), hearing: "awaiting" },
    );

    expect(connection.applyAudience).toHaveBeenLastCalledWith({
      participantIds: new Set(),
      video: new Map(),
    });
  });

  it("leaves a room-hearing room before joining the next space's proximity room", async () => {
    const { joined, session, steps } = setup();
    session.applyWorldMessage(
      callWith({ hearing: "room" }),
      presenceWith([NEARBY_ID], "room"),
    );
    await joined();

    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));

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
      expect(roomAt(0).connection.applyAudience).not.toHaveBeenCalled();
    },
  );

  it.each(["microphone", "camera"] as const)(
    "replays a %s turned on before the room connects",
    async (source) => {
      const { joined, session } = setup();
      const publication = localPublication(source);
      session.handleLocalPublicationChange({ publication, type: "added" });

      session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));

      const { connection } = await joined();
      expect(connection.handleLocalPublicationChange).toHaveBeenCalledWith({
        publication,
        type: "added",
      });
    },
  );

  it.each(["microphone", "camera"] as const)(
    "forgets a %s turned off before the room connects",
    async (source) => {
      const { joined, session } = setup();
      const publication = localPublication(source);
      session.handleLocalPublicationChange({ publication, type: "added" });
      session.handleLocalPublicationChange({
        previousTrack: publication.track,
        publicationId: publication.publicationId,
        source,
        type: "removed",
      });

      session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));

      const { connection } = await joined();
      expect(connection.handleLocalPublicationChange).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      "a new microphone",
      (): LocalPublicationChange => ({
        publication: localPublication("microphone"),
        type: "added",
      }),
    ],
    [
      "a new camera",
      (): LocalPublicationChange => ({
        publication: localPublication("camera"),
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

  it("hands every camera change to the room it joined", async () => {
    const { joined, session } = setup();
    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
    const { connection } = await joined();
    const first = localPublication("camera");
    const changes: LocalPublicationChange[] = [
      { publication: first, type: "added" },
      {
        previousTrack: first.track,
        publication: localPublication("camera"),
        type: "replaced",
      },
      {
        previousTrack: first.track,
        publicationId: first.publicationId,
        source: "camera",
        type: "removed",
      },
    ];

    for (const change of changes) session.handleLocalPublicationChange(change);

    expect(
      vi.mocked(connection.handleLocalPublicationChange).mock.calls,
    ).toEqual(changes.map((change) => [change]));
  });

  it.each([
    [
      "World ends the call",
      (room: Room, session: ReturnType<typeof setup>["session"]) =>
        session.applyWorldMessage(NO_CALL, presenceWith([NEARBY_ID])),
      "idle",
    ],
    [
      "World sends a call with a hearing it added later",
      (room: Room, session: ReturnType<typeof setup>["session"]) =>
        session.applyWorldMessage(
          callWith({ hearing: "unknown" }),
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

  it.each(["room", "proximity"] as const)(
    "measures first remote audio of a %s call from its receipt, once per call",
    async (hearing) => {
      const now = vi.fn().mockReturnValueOnce(100).mockReturnValue(250);
      const { joined, recordFirstAudioMilliseconds, session } = setup({ now });
      session.applyWorldMessage(
        callWith({ hearing }),
        presenceWith([NEARBY_ID], hearing),
      );
      const room = await joined();

      room.events.onFirstRemoteAudio();
      room.events.onFirstRemoteAudio();

      expect(recordFirstAudioMilliseconds).toHaveBeenCalledExactlyOnceWith(
        150,
        hearing,
      );
    },
  );

  it.each(["room", "proximity"] as const)(
    "records the first remote camera of a %s call with its hearing",
    async (hearing) => {
      const { joined, recordFirstVideo, session } = setup();
      session.applyWorldMessage(
        callWith({ hearing }),
        presenceWith([NEARBY_ID], hearing),
      );
      const room = await joined();

      room.events.onFirstRemoteVideo({
        connectionQuality: "good",
        waitedMs: 240,
      });

      expect(recordFirstVideo).toHaveBeenCalledExactlyOnceWith({
        connectionQuality: "good",
        hearing,
        waitedMs: 240,
      });
    },
  );

  it("never records a first camera from a room it already left", async () => {
    const { joined, recordFirstVideo, session } = setup();
    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
    const room = await joined();
    session.applyWorldMessage(NO_CALL, presenceWith([NEARBY_ID]));

    room.events.onFirstRemoteVideo({
      connectionQuality: "good",
      waitedMs: 240,
    });

    expect(recordFirstVideo).not.toHaveBeenCalled();
  });

  it("does not measure a call that arrived with nobody to meet", async () => {
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
