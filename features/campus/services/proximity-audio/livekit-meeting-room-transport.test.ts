import { describe, expect, it, vi } from "vitest";

import {
  fakeLivekitRoom,
  type FakeRemoteParticipant,
  type FakeRoom,
} from "../../testing/fake-livekit";
import {
  createTestMediaStream,
  createTestMediaTrack,
} from "../../testing/media-session-test-utils";
import type { LocalMediaPublication } from "../media-session/contracts";
import {
  type MeetingRoomConnection,
  type MeetingRoomEvents,
  RoomAccessDeniedError,
} from "./contracts";
import { createLivekitMeetingRoomTransport } from "./livekit-meeting-room-transport";

const ACCESS = { url: "wss://media.example.test", token: "room-token" };
const GRACE = "22222222-2222-4222-8222-222222222222";
const ALAN = "44444444-4444-4444-8444-444444444444";

function roomEvents() {
  return {
    onDisconnected: vi.fn(),
    onFirstRemoteAudio: vi.fn(),
    onRemotePublicationChange: vi.fn(),
  } satisfies MeetingRoomEvents;
}

function localMicrophone(deviceId: string) {
  const copy = createTestMediaTrack("audio", `${deviceId}-copy`);
  const track = Object.assign(createTestMediaTrack("audio", deviceId), {
    clone: vi.fn(() => copy),
  });
  const publication: LocalMediaPublication = {
    enabled: true,
    origin: "local",
    publicationId: `local-${deviceId}`,
    source: "microphone",
    stream: createTestMediaStream([track]),
    track,
  };
  return { copy, publication, track };
}

type LocalMicrophone = ReturnType<typeof localMicrophone>;

function addMicrophone(
  connection: MeetingRoomConnection,
  { publication }: LocalMicrophone,
) {
  return connection.handleLocalPublicationChange({
    publication,
    type: "added",
  });
}

function removeMicrophone(
  connection: MeetingRoomConnection,
  { publication, track }: LocalMicrophone,
) {
  return connection.handleLocalPublicationChange({
    previousTrack: track,
    publicationId: publication.publicationId,
    source: "microphone",
    type: "removed",
  });
}

function runningCopies(...microphones: LocalMicrophone[]) {
  return microphones.filter(
    ({ copy, track }) =>
      track.clone.mock.calls.length > copy.stop.mock.calls.length,
  );
}

function publishedAt(room: FakeRoom, index: number) {
  const published = room.published[index];
  if (!published) throw new Error(`Nothing was published at ${index}.`);
  return published;
}

async function joinedRoom() {
  const livekit = fakeLivekitRoom();
  const events = roomEvents();
  const transport = createLivekitMeetingRoomTransport(
    async () => livekit.module,
  );
  const connection = await transport.connect(
    ACCESS,
    events,
    new AbortController().signal,
  );

  return { connection, events, livekit, room: livekit.roomAt(0) };
}

describe("createLivekitMeetingRoomTransport", () => {
  it("joins the granted room, subscribing to nobody until asked, with three join attempts", async () => {
    const { room } = await joinedRoom();

    expect(room.connectCalls).toEqual([
      { ...ACCESS, options: { autoSubscribe: false, maxRetries: 3 } },
    ]);
  });

  it("subscribes only the microphones of the participants it is asked for", async () => {
    const { connection, livekit, room } = await joinedRoom();
    room.join(`${GRACE}:tab-1`, ["microphone", "camera", "screen_share"]);
    room.join(`${ALAN}:tab-1`, ["microphone"]);
    room.join(GRACE, ["microphone"]);
    room.join(`:${GRACE}`, ["microphone"]);

    connection.setSubscribedParticipantIds(new Set([GRACE]));

    expect(livekit.subscriptions).toEqual([
      { identity: `${GRACE}:tab-1`, source: "microphone", subscribed: true },
    ]);
  });

  it("unsubscribes a microphone once its participant is no longer asked for", async () => {
    const { connection, livekit, room } = await joinedRoom();
    room.join(`${GRACE}:tab-1`, ["microphone"]);
    connection.setSubscribedParticipantIds(new Set([GRACE]));

    connection.setSubscribedParticipantIds(new Set());

    expect(livekit.subscriptions.at(-1)).toEqual({
      identity: `${GRACE}:tab-1`,
      source: "microphone",
      subscribed: false,
    });
  });

  it("subscribes a microphone published after the ask", async () => {
    const { connection, livekit, room } = await joinedRoom();
    connection.setSubscribedParticipantIds(new Set([GRACE, ALAN]));

    room.arrive(`${GRACE}:tab-1`, ["camera", "microphone"]);

    expect(livekit.subscriptions).toEqual([
      { identity: `${GRACE}:tab-1`, source: "microphone", subscribed: true },
    ]);
  });

  it("hands each subscribed microphone to the media session under its user id", async () => {
    const { connection, events, room } = await joinedRoom();
    const grace = room.join(`${GRACE}:tab-1`, ["microphone"]);
    connection.setSubscribedParticipantIds(new Set([GRACE]));

    const track = room.deliver(grace, "microphone");

    expect(events.onRemotePublicationChange).toHaveBeenCalledExactlyOnceWith({
      publication: {
        enabled: true,
        origin: "remote",
        participantId: GRACE,
        publicationId: `${GRACE}:tab-1-microphone`,
        source: "microphone",
        stream: track.mediaStream,
        track: track.mediaStreamTrack,
      },
      type: "upserted",
    });
  });

  it("reports the room's first remote audio once", async () => {
    const { connection, events, room } = await joinedRoom();
    const grace = room.join(`${GRACE}:tab-1`, ["microphone"]);
    const alan = room.join(`${ALAN}:tab-1`, ["microphone"]);
    connection.setSubscribedParticipantIds(new Set([GRACE, ALAN]));

    room.deliver(grace, "microphone");
    room.deliver(alan, "microphone");

    expect(events.onFirstRemoteAudio).toHaveBeenCalledOnce();
  });

  it("drops a microphone that arrives after its participant left the ask", async () => {
    const { connection, events, room } = await joinedRoom();
    const grace = room.join(`${GRACE}:tab-1`, ["microphone"]);
    connection.setSubscribedParticipantIds(new Set([GRACE]));
    connection.setSubscribedParticipantIds(new Set());

    room.deliver(grace, "microphone");

    expect(events.onRemotePublicationChange).not.toHaveBeenCalled();
    expect(events.onFirstRemoteAudio).not.toHaveBeenCalled();
  });

  it.each<{
    name: string;
    end: (room: FakeRoom, participant: FakeRemoteParticipant) => void;
  }>([
    {
      name: "is unsubscribed",
      end: (room, participant) => room.unsubscribe(participant, "microphone"),
    },
    {
      name: "is unpublished",
      end: (room, participant) => room.unpublish(participant, "microphone"),
    },
    {
      name: "leaves with its participant",
      end: (room, participant) => room.leave(participant),
    },
  ])("removes a microphone that $name", async ({ end }) => {
    const { connection, events, room } = await joinedRoom();
    const grace = room.join(`${GRACE}:tab-1`, ["microphone", "camera"]);
    connection.setSubscribedParticipantIds(new Set([GRACE]));
    room.deliver(grace, "microphone");
    connection.setSubscribedParticipantIds(new Set());

    end(room, grace);

    expect(events.onRemotePublicationChange).toHaveBeenLastCalledWith({
      participantId: GRACE,
      publicationId: `${GRACE}:tab-1-microphone`,
      source: "microphone",
      type: "removed",
    });
    expect(events.onRemotePublicationChange).toHaveBeenCalledTimes(2);
  });

  it("publishes a copy of the member's microphone, never the track itself", async () => {
    const { connection, room } = await joinedRoom();
    const microphone = localMicrophone("mic-1");

    await addMicrophone(connection, microphone);

    expect(room.published).toEqual([
      expect.objectContaining({
        options: { source: "microphone" },
        track: microphone.copy,
      }),
    ]);
  });

  it("swaps in a copy of the new microphone and stops the old copy", async () => {
    const { connection, room } = await joinedRoom();
    const first = localMicrophone("mic-1");
    const second = localMicrophone("mic-2");
    await addMicrophone(connection, first);

    await connection.handleLocalPublicationChange({
      previousTrack: first.track,
      publication: second.publication,
      type: "replaced",
    });

    expect(publishedAt(room, 0).replaceTrack).toHaveBeenCalledExactlyOnceWith(
      second.copy,
      true,
    );
    expect(first.copy.stop).toHaveBeenCalledOnce();
    expect(first.track.stop).not.toHaveBeenCalled();
    expect(second.track.stop).not.toHaveBeenCalled();
  });

  it("unpublishes and stops the copy when the microphone turns off", async () => {
    const { connection, room } = await joinedRoom();
    const microphone = localMicrophone("mic-1");
    await addMicrophone(connection, microphone);

    await removeMicrophone(connection, microphone);

    expect(room.unpublished).toEqual([{ stop: false, track: microphone.copy }]);
    expect(microphone.copy.stop).toHaveBeenCalledOnce();
    expect(microphone.track.stop).not.toHaveBeenCalled();
  });

  it("turns the microphone off even while its publish is still in flight", async () => {
    const { connection, room } = await joinedRoom();
    const microphone = localMicrophone("mic-1");

    await Promise.all([
      addMicrophone(connection, microphone),
      removeMicrophone(connection, microphone),
    ]);

    expect(room.unpublished).toEqual([{ stop: false, track: microphone.copy }]);
  });

  it("leaves by disconnecting the room and stopping every copy, without reporting a drop", async () => {
    const { connection, events, room } = await joinedRoom();
    const microphone = localMicrophone("mic-1");
    await addMicrophone(connection, microphone);

    await connection.disconnect();

    expect(room.disconnectCalls).toEqual([true]);
    expect(microphone.copy.stop).toHaveBeenCalledOnce();
    expect(microphone.track.stop).not.toHaveBeenCalled();
    expect(events.onDisconnected).not.toHaveBeenCalled();
  });

  it("leaves no copy running, even of microphone changes still in flight when it leaves", async () => {
    const { connection, room } = await joinedRoom();
    const first = localMicrophone("mic-1");
    const second = localMicrophone("mic-2");
    const release = room.holdPublishes();
    const changes = [
      addMicrophone(connection, first),
      connection.handleLocalPublicationChange({
        previousTrack: first.track,
        publication: second.publication,
        type: "replaced",
      }),
    ];

    await connection.disconnect();
    release();
    await Promise.allSettled(changes);

    expect(runningCopies(first, second)).toEqual([]);
  });

  it("finishes leaving even when the room fails to disconnect", async () => {
    const { connection, room } = await joinedRoom();
    const microphone = localMicrophone("mic-1");
    await addMicrophone(connection, microphone);
    room.disconnectFails = true;

    await expect(connection.disconnect()).resolves.toBeUndefined();
    expect(microphone.copy.stop).toHaveBeenCalledOnce();
  });

  it("reports a drop the member did not ask for", async () => {
    const { events, room } = await joinedRoom();

    room.emit("disconnected");

    expect(events.onDisconnected).toHaveBeenCalledOnce();
  });

  it("stops joining once the call changes and leaves the half-joined room", async () => {
    const livekit = fakeLivekitRoom();
    livekit.control.connect = "hang";
    const controller = new AbortController();
    const joining = createLivekitMeetingRoomTransport(
      async () => livekit.module,
    ).connect(ACCESS, roomEvents(), controller.signal);
    await vi.waitFor(() => expect(livekit.rooms).toHaveLength(1));

    controller.abort();

    await expect(joining).rejects.toThrow();
    expect(livekit.roomAt(0).disconnectCalls).toEqual([true]);
  });

  it("builds no room for a call that already changed", async () => {
    const livekit = fakeLivekitRoom();

    const joining = createLivekitMeetingRoomTransport(
      async () => livekit.module,
    ).connect(ACCESS, roomEvents(), AbortSignal.abort());

    await expect(joining).rejects.toThrow();
    expect(livekit.rooms).toEqual([]);
  });

  it("stops waiting for a LiveKit download that stalls once the call changes", async () => {
    const controller = new AbortController();
    const joining = createLivekitMeetingRoomTransport(
      () => new Promise(() => {}),
    ).connect(ACCESS, roomEvents(), controller.signal);

    controller.abort();

    await expect(joining).rejects.toThrow();
  });

  it.each([
    { outcome: "deny", denied: true },
    { outcome: "reject", denied: false },
  ] as const)(
    "tells a refused grant ($outcome) apart from an unreachable server",
    async ({ outcome, denied }) => {
      const livekit = fakeLivekitRoom();
      livekit.control.connect = outcome;

      const joining = createLivekitMeetingRoomTransport(
        async () => livekit.module,
      ).connect(ACCESS, roomEvents(), new AbortController().signal);

      await expect(joining).rejects.toSatisfy(
        (error) => error instanceof RoomAccessDeniedError === denied,
      );
    },
  );
});
