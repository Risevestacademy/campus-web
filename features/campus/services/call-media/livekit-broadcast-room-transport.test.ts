import { describe, expect, it, vi } from "vitest";

import {
  type FakeLivekitRoom,
  fakeLivekitRoom,
} from "../../testing/fake-livekit";
import {
  createTestMediaStream,
  createTestMediaTrack,
} from "../../testing/media-session-test-utils";
import type { LocalMediaPublication } from "../media-session/contracts";
import type { RemotePublicationChange } from "../media-session/contracts";
import { type BroadcastRoomEvents, RoomAccessDeniedError } from "./contracts";
import { createLivekitBroadcastRoomTransport } from "./livekit-broadcast-room-transport";

function ownCapture(source: "camera" | "microphone") {
  const kind = source === "microphone" ? "audio" : "video";
  const copy = Object.assign(createTestMediaTrack(kind, `${source}-copy`), {
    stop: vi.fn(),
  });
  const track = Object.assign(createTestMediaTrack(kind, source), {
    clone: vi.fn(() => copy),
  });
  const publication: LocalMediaPublication = {
    enabled: true,
    origin: "local",
    publicationId: `local-${source}`,
    source,
    stream: createTestMediaStream([track]),
    track,
  };
  return { copy, publication, track };
}

const ACCESS = { url: "wss://media.example.test", token: "broadcast-token" };
const ADA = "11111111-1111-4111-8111-111111111111";
const GRACE = "22222222-2222-4222-8222-222222222222";

function roomEvents() {
  return {
    onDisconnected: vi.fn(),
    onRemotePublicationChange:
      vi.fn<(change: RemotePublicationChange) => void>(),
  } satisfies BroadcastRoomEvents;
}

type AlreadyInRoom = FakeLivekitRoom["control"]["alreadyInRoom"];

async function joinedRoom(alreadyInRoom: AlreadyInRoom = []) {
  const livekit = fakeLivekitRoom();
  livekit.control.alreadyInRoom = alreadyInRoom;
  const events = roomEvents();
  const connection = await createLivekitBroadcastRoomTransport(
    async () => livekit.module,
  ).connect(ACCESS, events, new AbortController().signal);
  return { connection, events, livekit, room: livekit.roomAt(0) };
}

describe("createLivekitBroadcastRoomTransport", () => {
  it("joins with World's url and token, subscribing nothing by itself", async () => {
    const { room } = await joinedRoom();

    expect(room.connectCalls).toEqual([
      {
        url: ACCESS.url,
        token: ACCESS.token,
        options: { autoSubscribe: false, maxRetries: 3 },
      },
    ]);
  });

  it("subscribes every microphone, and nothing else, of whoever is already speaking", async () => {
    const { livekit } = await joinedRoom([
      [`${ADA}:tab`, ["microphone", "camera"]],
    ]);

    expect(livekit.subscriptions).toEqual([
      { identity: `${ADA}:tab`, source: "microphone", subscribed: true },
    ]);
  });

  it("subscribes a microphone published after joining and hands it over", async () => {
    const { events, room } = await joinedRoom();

    const grace = room.arrive(
      `${GRACE}:tab`,
      ["microphone", "screen_share"],
      "  Grace Hopper ",
    );
    const track = room.deliver(grace, "microphone");

    expect(events.onRemotePublicationChange).toHaveBeenCalledExactlyOnceWith({
      publication: expect.objectContaining({
        enabled: true,
        origin: "remote",
        participantId: GRACE,
        publicationId: `${GRACE}:tab-microphone`,
        source: "microphone",
        speakerName: "Grace Hopper",
        stream: track.mediaStream,
        track: track.mediaStreamTrack,
      }),
      type: "upserted",
    });
  });

  it("never subscribes an identity World did not name", async () => {
    const { livekit, room } = await joinedRoom();

    room.arrive("not-a-member", ["microphone"]);

    expect(livekit.subscriptions).toEqual([]);
  });

  it("takes back a microphone it handed over once it is unpublished, once", async () => {
    const { events, room } = await joinedRoom();
    const grace = room.arrive(`${GRACE}:tab`, ["microphone"]);
    room.deliver(grace, "microphone");
    events.onRemotePublicationChange.mockClear();

    room.leave(grace);

    expect(events.onRemotePublicationChange).toHaveBeenCalledExactlyOnceWith({
      participantId: GRACE,
      publicationId: `${GRACE}:tab-microphone`,
      source: "microphone",
      type: "removed",
    });
  });

  it("reports a drop, but not its own leave", async () => {
    const dropped = await joinedRoom();
    dropped.room.emit("disconnected");
    expect(dropped.events.onDisconnected).toHaveBeenCalledOnce();

    const left = await joinedRoom();
    await left.connection.disconnect();
    await left.connection.disconnect();
    expect(left.events.onDisconnected).not.toHaveBeenCalled();
    expect(left.room.disconnectCalls).toEqual([true, true]);
  });

  it.each([
    { outcome: "deny", denied: true },
    { outcome: "reject", denied: false },
  ] as const)(
    "a $outcome join rejects and leaves the half-joined room",
    async ({ outcome, denied }) => {
      const livekit = fakeLivekitRoom();
      livekit.control.connect = outcome;

      await expect(
        createLivekitBroadcastRoomTransport(async () => livekit.module).connect(
          ACCESS,
          roomEvents(),
          new AbortController().signal,
        ),
      ).rejects.toSatisfy(
        (error) => error instanceof RoomAccessDeniedError === denied,
      );
      expect(livekit.roomAt(0).disconnectCalls).toEqual([true]);
    },
  );

  it("rejects once its signal aborts mid-join", async () => {
    const livekit = fakeLivekitRoom();
    livekit.control.connect = "hang";
    const controller = new AbortController();

    const joining = createLivekitBroadcastRoomTransport(
      async () => livekit.module,
    ).connect(ACCESS, roomEvents(), controller.signal);
    await vi.waitFor(() => expect(livekit.rooms).toHaveLength(1));
    controller.abort();

    await expect(joining).rejects.toThrow();
    expect(livekit.roomAt(0).disconnectCalls).toEqual([true]);
  });

  it.each([undefined, "", "   "])(
    "hands over no name when the token carries %j",
    async (name) => {
      const { events, room } = await joinedRoom();

      room.deliver(
        room.arrive(`${GRACE}:tab`, ["microphone"], name),
        "microphone",
      );

      expect(events.onRemotePublicationChange).toHaveBeenCalledWith({
        publication: expect.objectContaining({ speakerName: null }),
        type: "upserted",
      });
    },
  );

  it("publishes a copy of the admin's microphone, and nothing else", async () => {
    const { connection, room } = await joinedRoom();
    const microphone = ownCapture("microphone");
    const camera = ownCapture("camera");

    await connection.handleLocalPublicationChange({
      publication: camera.publication,
      type: "added",
    });
    await connection.handleLocalPublicationChange({
      publication: microphone.publication,
      type: "added",
    });

    expect(room.published).toEqual([
      expect.objectContaining({
        options: { source: "microphone" },
        track: microphone.copy,
      }),
    ]);
    expect(camera.track.clone).not.toHaveBeenCalled();
  });

  it("takes the microphone down, and stops its copy when it leaves", async () => {
    const { connection, room } = await joinedRoom();
    const microphone = ownCapture("microphone");
    await connection.handleLocalPublicationChange({
      publication: microphone.publication,
      type: "added",
    });

    await connection.handleLocalPublicationChange({
      previousTrack: microphone.track,
      publicationId: microphone.publication.publicationId,
      source: "microphone",
      type: "removed",
    });
    expect(room.unpublished).toEqual([{ track: microphone.copy, stop: false }]);

    await connection.handleLocalPublicationChange({
      publication: microphone.publication,
      type: "added",
    });
    await connection.disconnect();
    expect(microphone.copy.stop).toHaveBeenCalledTimes(2);
  });

  it("rejects a microphone the room refuses, stopping its copy", async () => {
    const { connection, room } = await joinedRoom();
    room.publishFails = true;
    const microphone = ownCapture("microphone");

    await expect(
      connection.handleLocalPublicationChange({
        publication: microphone.publication,
        type: "added",
      }),
    ).rejects.toThrow("publish failed");
    expect(microphone.copy.stop).toHaveBeenCalledOnce();
  });
});
