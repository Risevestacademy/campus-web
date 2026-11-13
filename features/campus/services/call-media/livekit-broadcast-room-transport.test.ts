import { describe, expect, it, vi } from "vitest";

import {
  type FakeLivekitRoom,
  fakeLivekitRoom,
} from "../../testing/fake-livekit";
import type { RemotePublicationChange } from "../media-session/contracts";
import { type BroadcastRoomEvents, RoomAccessDeniedError } from "./contracts";
import { createLivekitBroadcastRoomTransport } from "./livekit-broadcast-room-transport";

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

  it("hands a microphone over again whenever its speaker mutes or unmutes", async () => {
    const { events, room } = await joinedRoom();
    const grace = room.arrive(`${GRACE}:tab`, ["microphone"]);
    room.deliver(grace, "microphone");
    events.onRemotePublicationChange.mockClear();

    room.mute(grace, "microphone", true);
    room.mute(grace, "microphone", false);

    expect(
      events.onRemotePublicationChange.mock.calls.map(([change]) =>
        change.type === "upserted" ? change.publication.enabled : change.type,
      ),
    ).toEqual([false, true]);
  });

  it("ignores a mute on a microphone it never handed over", async () => {
    const { events, room } = await joinedRoom();
    const grace = room.arrive(`${GRACE}:tab`, ["microphone"]);

    room.mute(grace, "microphone", true);

    expect(events.onRemotePublicationChange).not.toHaveBeenCalled();
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
});
