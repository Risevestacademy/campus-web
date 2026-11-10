import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyServerMessage,
  EMPTY_PRESENCE,
  type Hearing,
  type Presence,
} from "@/core/presence";
import type { CallMessage, ServerMessage } from "@/core/realtime";

import {
  createTestMediaStream,
  createTestMediaTrack,
} from "../../testing/media-session-test-utils";
import type {
  LocalMediaPublication,
  LocalPublicationChange,
  PublicationSource,
  RemoteMediaPublication,
  ScreenShareEndReason,
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
    ...EMPTY_PRESENCE,
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
    onCameraPublishOutcome: vi.fn(),
    onRemoteAudioGainsChange: vi.fn(),
    onRemotePublicationChange: vi.fn(),
    onRemoteScreenSharesChange: vi.fn(),
    onScreenShareEnded: vi.fn(),
    onStatusChange: vi.fn(),
  };
  const recordFirstAudioMilliseconds = vi.fn();
  const recordFirstVideo = vi.fn();
  const recordScreenShareEnded = vi.fn();
  const recordScreenShareReady = vi.fn();
  const refreshCall = vi.fn(() => true);
  const session = createCallMediaSession({
    now: options.now ?? (() => 0),
    pinMediaUrl: options.pinMediaUrl ?? ((url) => url),
    recordFirstAudioMilliseconds,
    recordFirstVideo,
    recordScreenShareEnded,
    recordScreenShareReady,
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
    recordScreenShareEnded,
    recordScreenShareReady,
    refreshCall,
    roomAt,
    roomTransport,
    session,
    steps,
  };
}

function localPublication(source: PublicationSource): LocalMediaPublication {
  const track = createTestMediaTrack(
    source === "microphone" ? "audio" : "video",
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

  it.each(["walking", "walkEnded"] as const)(
    "updates proximity gain on %s while the nearby roster stays the same",
    async (type) => {
      const { callbacks, joined, session } = setup();
      let presence = presenceWith([NEARBY_ID]);
      session.applyWorldMessage(CALL, presence);
      const { connection } = await joined();
      vi.mocked(connection.applyAudience).mockClear();

      for (const [x, gain] of [
        [3, 1 - 1 / 6],
        [0, 1 - 4 / 6],
      ] as const) {
        const player = {
          userId: SELF_ID,
          x,
          y: 1,
          facing: "right" as const,
        };
        const message: ServerMessage =
          type === "walking"
            ? { type, player }
            : { type, player, reason: "arrived", spaceKey: null };
        presence = applyServerMessage(presence, message);

        session.applyWorldMessage(message, presence);

        expect(callbacks.onRemoteAudioGainsChange).toHaveBeenLastCalledWith({
          [NEARBY_ID]: gain,
        });
      }
      expect(connection.applyAudience).not.toHaveBeenCalled();
    },
  );

  it("asks only for the cameras on screen of whoever the member meets", async () => {
    const { joined, session } = setup();
    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
    const { connection } = await joined();

    session.setVideoDemand({
      camera: new Map([
        [NEARBY_ID, "high"],
        [STRANGER_ID, "low"],
      ]),
      screen: new Map([
        [NEARBY_ID, "low"],
        [STRANGER_ID, "high"],
      ]),
    });

    expect(connection.applyAudience).toHaveBeenLastCalledWith({
      participantIds: new Set([NEARBY_ID]),
      video: {
        camera: new Map([[NEARBY_ID, "high"]]),
        screen: new Map([[NEARBY_ID, "low"]]),
      },
    });
  });

  it("asks for the cameras on screen as soon as a room joins", async () => {
    const { joined, session } = setup();
    session.setVideoDemand({
      camera: new Map([[NEARBY_ID, "low"]]),
      screen: new Map(),
    });

    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));

    const { connection } = await joined();
    expect(connection.applyAudience).toHaveBeenCalledWith({
      participantIds: new Set([NEARBY_ID]),
      video: { camera: new Map([[NEARBY_ID, "low"]]), screen: new Map() },
    });
  });

  it("drops every camera in the same task as a crossing empties the roster", async () => {
    const { joined, session } = setup();
    session.setVideoDemand({
      camera: new Map([[NEARBY_ID, "low"]]),
      screen: new Map(),
    });
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
      video: { camera: new Map(), screen: new Map() },
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

  it("keeps the call, and says so, when the room rejects the camera", async () => {
    const { callbacks, joined, session } = setup();
    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
    const { connection } = await joined();
    vi.mocked(connection.handleLocalPublicationChange).mockRejectedValueOnce(
      new Error("publish failed"),
    );

    session.handleLocalPublicationChange({
      publication: localPublication("camera"),
      type: "added",
    });

    await vi.waitFor(() =>
      expect(callbacks.onCameraPublishOutcome).toHaveBeenLastCalledWith(true),
    );
    expect(callbacks.onStatusChange).toHaveBeenLastCalledWith("connected");
    expect(connection.disconnect).not.toHaveBeenCalled();
  });

  describe("the camera's latest outcome", () => {
    const camera = localPublication("camera");
    const CAMERA_ON: LocalPublicationChange = {
      publication: camera,
      type: "added",
    };
    const CAMERA_OFF: LocalPublicationChange = {
      previousTrack: camera.track,
      publicationId: camera.publicationId,
      source: "camera",
      type: "removed",
    };

    async function refusedCamera() {
      const room = setup();
      room.session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
      const { connection } = await room.joined();
      vi.mocked(connection.handleLocalPublicationChange).mockRejectedValueOnce(
        new Error("publish failed"),
      );
      room.session.handleLocalPublicationChange(CAMERA_ON);
      await vi.waitFor(() =>
        expect(room.callbacks.onCameraPublishOutcome).toHaveBeenLastCalledWith(
          true,
        ),
      );
      return { ...room, connection };
    }

    it("ends on a success when a quick toggle's first publish fails after the rest were made", async () => {
      const { callbacks, joined, session } = setup();
      session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
      const { connection } = await joined();
      callbacks.onCameraPublishOutcome.mockClear();
      vi.mocked(connection.handleLocalPublicationChange).mockRejectedValueOnce(
        new Error("publish failed"),
      );

      session.handleLocalPublicationChange(CAMERA_ON);
      session.handleLocalPublicationChange(CAMERA_OFF);
      session.handleLocalPublicationChange(CAMERA_ON);

      await vi.waitFor(() =>
        expect(callbacks.onCameraPublishOutcome.mock.calls).toEqual([
          [true],
          [false],
          [false],
        ]),
      );
    });

    it("is a success when the next space's room takes the replayed camera", async () => {
      const { callbacks, joined, session } = await refusedCamera();

      session.applyWorldMessage(
        callWith({ token: "next-space-token" }),
        presenceWith([NEARBY_ID]),
      );
      const { connection } = await joined(2);

      await vi.waitFor(() =>
        expect(connection.handleLocalPublicationChange).toHaveBeenCalledWith(
          CAMERA_ON,
        ),
      );
      await vi.waitFor(() =>
        expect(callbacks.onCameraPublishOutcome).toHaveBeenLastCalledWith(
          false,
        ),
      );
    });

    it("clears when the member turns the camera off", async () => {
      const { callbacks, session } = await refusedCamera();

      session.handleLocalPublicationChange(CAMERA_OFF);

      await vi.waitFor(() =>
        expect(callbacks.onCameraPublishOutcome).toHaveBeenLastCalledWith(
          false,
        ),
      );
    });

    it("never calls a failed turn-off a refused camera", async () => {
      const { callbacks, connection, session } = await refusedCamera();
      callbacks.onCameraPublishOutcome.mockClear();
      vi.mocked(connection.handleLocalPublicationChange).mockRejectedValueOnce(
        new Error("negotiation failed"),
      );

      session.handleLocalPublicationChange(CAMERA_OFF);

      await vi.waitFor(() =>
        expect(
          callbacks.onCameraPublishOutcome,
        ).toHaveBeenCalledExactlyOnceWith(false),
      );
      expect(connection.disconnect).not.toHaveBeenCalled();
    });

    it("clears when the call ends", async () => {
      const { callbacks, session } = await refusedCamera();

      session.applyWorldMessage(NO_CALL, presenceWith([NEARBY_ID]));

      expect(callbacks.onCameraPublishOutcome).toHaveBeenLastCalledWith(false);
    });

    it("ignores a refusal from a room it already left", async () => {
      const refusal = Promise.withResolvers<void>();
      const { callbacks, joined, session } = setup();
      session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
      const { connection } = await joined();
      vi.mocked(connection.handleLocalPublicationChange).mockReturnValueOnce(
        refusal.promise,
      );
      session.handleLocalPublicationChange(CAMERA_ON);
      session.applyWorldMessage(NO_CALL, presenceWith([NEARBY_ID]));

      refusal.reject(new Error("publish failed"));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(callbacks.onCameraPublishOutcome).not.toHaveBeenCalledWith(true);
    });
  });

  it("leaves the audience alone when a frame changes neither the roster nor the cameras", async () => {
    const { callbacks, joined, session } = setup();
    const presence = presenceWith([NEARBY_ID]);
    session.applyWorldMessage(CALL, presence);
    const { connection } = await joined();
    vi.mocked(connection.applyAudience).mockClear();
    callbacks.onRemoteAudioGainsChange.mockClear();

    session.applyWorldMessage(PEER_MOVED_AWAY, { ...presence });

    expect(connection.applyAudience).not.toHaveBeenCalled();
    expect(callbacks.onRemoteAudioGainsChange).toHaveBeenCalledOnce();
  });

  it("gives a new room the same roster the last one had", async () => {
    const { joined, session } = setup();
    const presence = presenceWith([NEARBY_ID]);
    session.applyWorldMessage(CALL, presence);
    await joined();

    session.applyWorldMessage(callWith({ token: "next-token" }), presence);

    const { connection } = await joined(2);
    expect(connection.applyAudience).toHaveBeenCalledOnce();
  });

  it("still releases a track when the track it replaced is removed after it", async () => {
    const { callbacks, joined, session } = setup();
    session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
    const room = await joined();
    const previous = remoteMicrophone();
    const replacement = { ...previous, publicationId: "remote-microphone-2" };
    room.events.onRemotePublicationChange({
      publication: previous,
      type: "upserted",
    });
    room.events.onRemotePublicationChange({
      publication: replacement,
      type: "upserted",
    });
    room.events.onRemotePublicationChange({
      participantId: NEARBY_ID,
      publicationId: previous.publicationId,
      source: "microphone",
      type: "removed",
    });

    session.applyWorldMessage(NO_CALL, presenceWith([NEARBY_ID]));

    expect(callbacks.onRemotePublicationChange).toHaveBeenLastCalledWith({
      participantId: NEARBY_ID,
      publicationId: replacement.publicationId,
      source: "microphone",
      type: "removed",
    });
  });

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

  describe("the member's screen", () => {
    const SCREEN_ADDED = {
      publication: localPublication("screen"),
      type: "added",
    } satisfies LocalPublicationChange;

    function screenRemoved(endReason: ScreenShareEndReason) {
      return {
        endReason,
        previousTrack: SCREEN_ADDED.publication.track,
        publicationId: SCREEN_ADDED.publication.publicationId,
        source: "screen",
        type: "removed",
      } satisfies LocalPublicationChange;
    }

    async function sharing(
      options: Parameters<typeof setup>[0] = {},
      hearing: Hearing = "proximity",
    ) {
      const context = setup(options);
      const presence = presenceWith([NEARBY_ID], hearing);
      context.session.applyWorldMessage(callWith({ hearing }), presence);
      const room = await context.joined();
      context.callbacks.onScreenShareEnded.mockClear();
      context.session.handleLocalPublicationChange(SCREEN_ADDED);
      return { ...context, room };
    }

    it("publishes a share to the room the member is in", async () => {
      const { callbacks, room } = await sharing();

      expect(
        room.connection.handleLocalPublicationChange,
      ).toHaveBeenCalledExactlyOnceWith(SCREEN_ADDED);
      expect(callbacks.onScreenShareEnded).not.toHaveBeenCalled();
    });

    it("keeps the call when the room refuses a share, and ends the share", async () => {
      const { callbacks, joined, session } = setup();
      session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
      const { connection } = await joined();
      callbacks.onScreenShareEnded.mockClear();
      vi.mocked(connection.handleLocalPublicationChange).mockRejectedValueOnce(
        new Error("refused"),
      );

      session.handleLocalPublicationChange(SCREEN_ADDED);

      await vi.waitFor(() =>
        expect(callbacks.onScreenShareEnded).toHaveBeenCalledExactlyOnceWith(
          "publish_failed",
        ),
      );
      expect(callbacks.onStatusChange).toHaveBeenLastCalledWith("connected");
      expect(connection.disconnect).not.toHaveBeenCalled();
    });

    it("keeps the call when taking a share down fails", async () => {
      const { callbacks, room, session } = await sharing();
      vi.mocked(
        room.connection.handleLocalPublicationChange,
      ).mockRejectedValueOnce(new Error("negotiation failed"));

      session.handleLocalPublicationChange(screenRemoved("stopped"));
      await vi.waitFor(() =>
        expect(
          room.connection.handleLocalPublicationChange,
        ).toHaveBeenCalledTimes(2),
      );
      await Promise.resolve();

      expect(callbacks.onStatusChange).toHaveBeenLastCalledWith("connected");
      expect(callbacks.onScreenShareEnded).not.toHaveBeenCalled();
    });

    it("never carries a share into the next room", async () => {
      const { callbacks, joined, roomAt, session } = await sharing();

      session.applyWorldMessage(
        callWith({ token: "next-room" }),
        presenceWith([NEARBY_ID]),
      );

      expect(callbacks.onScreenShareEnded).toHaveBeenCalledExactlyOnceWith(
        "room_closed",
      );
      const next = await joined(2);
      expect(
        next.connection.handleLocalPublicationChange,
      ).not.toHaveBeenCalled();
      expect(roomAt(0).connection.disconnect).toHaveBeenCalled();
    });

    it.each<[string, (context: Awaited<ReturnType<typeof sharing>>) => void]>([
      [
        "World ends the call",
        ({ session }) =>
          session.applyWorldMessage(NO_CALL, presenceWith([NEARBY_ID])),
      ],
      ["the member retries the call", ({ session }) => session.retry()],
      ["the room drops", ({ room }) => room.events.onDisconnected()],
    ])("ends a share when %s", async (_name, act) => {
      const context = await sharing();

      act(context);

      expect(context.callbacks.onScreenShareEnded).toHaveBeenCalledWith(
        "room_closed",
      );
    });

    it("ends a share in the same task as the roster empties", async () => {
      const { callbacks, session } = await sharing();

      session.applyWorldMessage(NOBODY_NEARBY, presenceWith([]));

      expect(callbacks.onScreenShareEnded).toHaveBeenCalledExactlyOnceWith(
        "meeting_ended",
      );
    });

    it("reports a crossing as the call changing, not the meeting ending", async () => {
      const { callbacks, session } = await sharing();

      session.applyWorldMessage(
        { type: "spaceChanged", userId: SELF_ID, spaceKey: "library" },
        { ...presenceWith([]), hearing: "awaiting" },
      );

      expect(callbacks.onScreenShareEnded).toHaveBeenCalledExactlyOnceWith(
        "room_closed",
      );
    });

    it("takes a share off a closing room before it disconnects", async () => {
      const { callbacks, room, session } = await sharing();
      callbacks.onScreenShareEnded.mockImplementationOnce((reason) =>
        session.handleLocalPublicationChange(screenRemoved(reason)),
      );

      session.applyWorldMessage(NO_CALL, presenceWith([NEARBY_ID]));

      expect(
        room.connection.handleLocalPublicationChange,
      ).toHaveBeenLastCalledWith(screenRemoved("room_closed"));
    });

    it("does not end the next share over a refusal of the last one", async () => {
      const { callbacks, joined, session } = setup();
      session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
      const { connection } = await joined();
      callbacks.onScreenShareEnded.mockClear();
      const refusal = Promise.withResolvers<void>();
      vi.mocked(connection.handleLocalPublicationChange).mockReturnValueOnce(
        refusal.promise,
      );
      session.handleLocalPublicationChange(SCREEN_ADDED);
      session.handleLocalPublicationChange(screenRemoved("stopped"));
      session.handleLocalPublicationChange({
        publication: localPublication("screen"),
        type: "added",
      });

      refusal.reject(new Error("refused"));
      await refusal.promise.catch(() => undefined);
      await Promise.resolve();

      expect(callbacks.onScreenShareEnded).not.toHaveBeenCalled();
    });

    it("keeps a share while the roster only changes", async () => {
      const { callbacks, session } = await sharing();

      session.applyWorldMessage(
        { type: "nearby", userIds: [STRANGER_ID] },
        presenceWith([STRANGER_ID]),
      );

      expect(callbacks.onScreenShareEnded).not.toHaveBeenCalled();
    });

    it("ends a share picked while no room is joined, without publishing it", async () => {
      const { callbacks, session } = setup();

      session.handleLocalPublicationChange(SCREEN_ADDED);

      expect(callbacks.onScreenShareEnded).toHaveBeenCalledExactlyOnceWith(
        "room_closed",
      );
    });

    it("ends a share picked after the roster emptied, without publishing it", async () => {
      const { callbacks, joined, session } = setup();
      session.applyWorldMessage(CALL, presenceWith([]));
      const { connection } = await joined();
      callbacks.onScreenShareEnded.mockClear();

      session.handleLocalPublicationChange(SCREEN_ADDED);

      expect(callbacks.onScreenShareEnded).toHaveBeenCalledExactlyOnceWith(
        "meeting_ended",
      );
      expect(connection.handleLocalPublicationChange).not.toHaveBeenCalled();
    });

    it("records how a share ended, how long it ran, and under which hearing", async () => {
      let clock = 1_000;
      const { recordScreenShareEnded, session } = await sharing(
        { now: () => clock },
        "room",
      );
      clock = 4_500;

      session.handleLocalPublicationChange(screenRemoved("browser_stopped"));

      expect(recordScreenShareEnded).toHaveBeenCalledExactlyOnceWith({
        durationMs: 3_500,
        hearing: "room",
        reason: "browser_stopped",
      });
    });

    it("records an end only for a share that reached a room", async () => {
      const { recordScreenShareEnded, session } = setup();

      session.handleLocalPublicationChange(SCREEN_ADDED);
      session.handleLocalPublicationChange(screenRemoved("room_closed"));

      expect(recordScreenShareEnded).not.toHaveBeenCalled();
    });

    it("tells the media session who else is sharing, and clears them with the room", async () => {
      const { callbacks, joined, session } = setup();
      session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
      const room = await joined();

      room.events.onRemoteScreenSharesChange(new Set([NEARBY_ID]));
      expect(callbacks.onRemoteScreenSharesChange).toHaveBeenLastCalledWith(
        new Set([NEARBY_ID]),
      );

      session.applyWorldMessage(NO_CALL, presenceWith([NEARBY_ID]));
      expect(callbacks.onRemoteScreenSharesChange).toHaveBeenLastCalledWith(
        new Set(),
      );
    });

    it("ignores who is sharing in a room the member already left", async () => {
      const { callbacks, joined, session } = setup();
      session.applyWorldMessage(CALL, presenceWith([NEARBY_ID]));
      const room = await joined();
      session.applyWorldMessage(NO_CALL, presenceWith([NEARBY_ID]));
      callbacks.onRemoteScreenSharesChange.mockClear();

      room.events.onRemoteScreenSharesChange(new Set([NEARBY_ID]));

      expect(callbacks.onRemoteScreenSharesChange).not.toHaveBeenCalled();
    });

    it("records the first viewer with the call's hearing", async () => {
      const { recordScreenShareReady, room } = await sharing({}, "room");

      room.events.onFirstScreenViewer({
        connectionQuality: "good",
        waitedMs: 180,
      });

      expect(recordScreenShareReady).toHaveBeenCalledExactlyOnceWith({
        connectionQuality: "good",
        hearing: "room",
        waitedMs: 180,
      });
    });
  });
});
