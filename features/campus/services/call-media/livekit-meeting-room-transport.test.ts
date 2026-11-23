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
import type {
  LocalMediaPublication,
  PublicationSource,
  VideoLayer,
} from "../media-session/contracts";
import {
  type MeetingAudience,
  type MeetingRoomConnection,
  type MeetingRoomEvents,
  RoomAccessDeniedError,
} from "./contracts";
import { createLivekitMeetingRoomTransport } from "./livekit-meeting-room-transport";

const ACCESS = { url: "wss://media.example.test", token: "room-token" };
const GRACE = "22222222-2222-4222-8222-222222222222";
const ALAN = "44444444-4444-4444-8444-444444444444";

function audience(
  participantIds: readonly string[],
  cameras: readonly (readonly [string, VideoLayer])[] = [],
  screens: readonly (readonly [string, VideoLayer])[] = [],
): MeetingAudience {
  return {
    participantIds: new Set(participantIds),
    video: { camera: new Map(cameras), screen: new Map(screens) },
  };
}

function roomEvents() {
  return {
    onDisconnected: vi.fn(),
    onFirstRemoteAudio: vi.fn(),
    onFirstRemoteVideo: vi.fn(),
    onFirstScreenViewer: vi.fn(),
    onRemotePublicationChange: vi.fn(),
    onRemoteScreenSharesChange: vi.fn(),
  } satisfies MeetingRoomEvents;
}

function localCapture(source: PublicationSource, deviceId: string) {
  const kind = source === "microphone" ? "audio" : "video";
  const copy = createTestMediaTrack(kind, `${deviceId}-copy`);
  const track = Object.assign(createTestMediaTrack(kind, deviceId), {
    clone: vi.fn(() => copy),
  });
  const publication: LocalMediaPublication = {
    enabled: true,
    origin: "local",
    publicationId: `local-${deviceId}`,
    source,
    stream: createTestMediaStream([track]),
    track,
  };
  return { copy, publication, track };
}

const localMicrophone = (deviceId: string) =>
  localCapture("microphone", deviceId);

type LocalCapture = ReturnType<typeof localCapture>;

function addCapture(
  connection: MeetingRoomConnection,
  { publication }: LocalCapture,
) {
  return connection.handleLocalPublicationChange({
    publication,
    type: "added",
  });
}

function removeCapture(
  connection: MeetingRoomConnection,
  { publication, track }: LocalCapture,
) {
  return connection.handleLocalPublicationChange({
    previousTrack: track,
    publicationId: publication.publicationId,
    source: publication.source,
    type: "removed",
  });
}

function runningCopies(...captures: LocalCapture[]) {
  return captures.filter(
    ({ copy, track }) =>
      track.clone.mock.calls.length > copy.stop.mock.calls.length,
  );
}

function publishedAt(room: FakeRoom, index: number) {
  const published = room.published[index];
  if (!published) throw new Error(`Nothing was published at ${index}.`);
  return published;
}

async function joinedRoom(now: () => number = () => 0) {
  const livekit = fakeLivekitRoom();
  const events = roomEvents();
  const transport = createLivekitMeetingRoomTransport(
    async () => livekit.module,
    now,
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

  it("lets nobody subscribe to the member's tracks once it joins", async () => {
    const { room } = await joinedRoom();

    expect(room.grants).toEqual([
      { allParticipantsAllowed: false, identities: [] },
    ]);
  });

  it("lets only the asked-for participants subscribe to the member's tracks", async () => {
    const { connection, room } = await joinedRoom();
    room.join(`${GRACE}:tab-2`, ["microphone"]);
    room.join(`${GRACE}:tab-1`, ["microphone"]);
    room.join(`${ALAN}:tab-1`, ["microphone"]);
    room.join(GRACE, ["microphone"]);
    room.join(`:${GRACE}`, ["microphone"]);

    connection.applyAudience(audience([GRACE]));

    expect(room.grants.at(-1)).toEqual({
      allParticipantsAllowed: false,
      identities: [`${GRACE}:tab-1`, `${GRACE}:tab-2`],
    });
  });

  it("lets an asked-for participant who joins the room later subscribe", async () => {
    const { connection, room } = await joinedRoom();
    connection.applyAudience(audience([GRACE]));

    room.arrive(`${GRACE}:tab-1`, ["microphone"]);

    expect(room.grants.at(-1)).toEqual({
      allParticipantsAllowed: false,
      identities: [`${GRACE}:tab-1`],
    });
  });

  // Each grant is a signal message to the SFU.
  it("tells the SFU only when who may subscribe changes", async () => {
    const { connection, room } = await joinedRoom();
    room.join(`${GRACE}:tab-1`, ["microphone"]);

    connection.applyAudience(audience([GRACE]));
    connection.applyAudience(audience([GRACE]));
    room.arrive(`${ALAN}:tab-1`, ["microphone"]);

    expect(room.grants).toHaveLength(2);
  });

  it("subscribes only the microphones of the participants it is asked for", async () => {
    const { connection, livekit, room } = await joinedRoom();
    room.join(`${GRACE}:tab-1`, ["microphone", "camera", "screen_share"]);
    room.join(`${ALAN}:tab-1`, ["microphone"]);
    room.join(GRACE, ["microphone"]);
    room.join(`:${GRACE}`, ["microphone"]);

    connection.applyAudience(audience([GRACE]));

    expect(livekit.subscriptions).toEqual([
      { identity: `${GRACE}:tab-1`, source: "microphone", subscribed: true },
    ]);
  });

  it("unsubscribes a microphone once its participant is no longer asked for", async () => {
    const { connection, livekit, room } = await joinedRoom();
    room.join(`${GRACE}:tab-1`, ["microphone"]);
    connection.applyAudience(audience([GRACE]));

    connection.applyAudience(audience([]));

    expect(livekit.subscriptions.at(-1)).toEqual({
      identity: `${GRACE}:tab-1`,
      source: "microphone",
      subscribed: false,
    });
  });

  it("subscribes a microphone published after the ask", async () => {
    const { connection, livekit, room } = await joinedRoom();
    connection.applyAudience(audience([GRACE, ALAN]));

    room.arrive(`${GRACE}:tab-1`, ["camera", "microphone"]);

    expect(livekit.subscriptions).toEqual([
      { identity: `${GRACE}:tab-1`, source: "microphone", subscribed: true },
    ]);
  });

  it.each(["microphone", "camera"] as const)(
    "hands each subscribed %s to the media session under its user id",
    async (source) => {
      const { connection, events, room } = await joinedRoom();
      const grace = room.join(`${GRACE}:tab-1`, [source]);
      connection.applyAudience(audience([GRACE], [[GRACE, "low"]]));

      const track = room.deliver(grace, source);

      expect(events.onRemotePublicationChange).toHaveBeenCalledExactlyOnceWith({
        publication: {
          enabled: true,
          origin: "remote",
          participantId: GRACE,
          publicationId: `${GRACE}:tab-1-${source}`,
          source,
          stream: track.mediaStream,
          track: track.mediaStreamTrack,
        },
        type: "upserted",
      });
    },
  );

  it("subscribes only the cameras on screen of the asked-for participants", async () => {
    const { connection, livekit, room } = await joinedRoom();
    room.join(`${GRACE}:tab-1`, ["camera", "screen_share"]);
    room.join(`${ALAN}:tab-1`, ["camera"]);

    connection.applyAudience(audience([GRACE, ALAN], [[GRACE, "low"]]));

    expect(livekit.subscriptions).toEqual([
      { identity: `${GRACE}:tab-1`, source: "camera", subscribed: true },
    ]);
  });

  it("unsubscribes a camera once its tile leaves the screen", async () => {
    const { connection, livekit, room } = await joinedRoom();
    room.join(`${GRACE}:tab-1`, ["camera"]);
    connection.applyAudience(audience([GRACE], [[GRACE, "low"]]));

    connection.applyAudience(audience([GRACE]));

    expect(livekit.subscriptions.at(-1)).toEqual({
      identity: `${GRACE}:tab-1`,
      source: "camera",
      subscribed: false,
    });
  });

  it("asks the SFU for a camera's layer only when its tile changes size", async () => {
    const { connection, livekit, room } = await joinedRoom();
    room.join(`${GRACE}:tab-1`, ["camera"]);

    connection.applyAudience(audience([GRACE], [[GRACE, "low"]]));
    connection.applyAudience(audience([GRACE], [[GRACE, "low"]]));
    connection.applyAudience(audience([GRACE], [[GRACE, "medium"]]));
    connection.applyAudience(audience([GRACE], [[GRACE, "high"]]));

    expect(livekit.qualities).toEqual([
      { identity: `${GRACE}:tab-1`, quality: "LOW" },
      { identity: `${GRACE}:tab-1`, quality: "MEDIUM" },
      { identity: `${GRACE}:tab-1`, quality: "HIGH" },
    ]);
  });

  // A full reconnect rebuilds every remote publication under its old trackSid,
  // and a new publication starts on LiveKit's high layer.
  it("asks a rebuilt camera publication for its layer again", async () => {
    const { connection, livekit, room } = await joinedRoom();
    const grace = room.join(`${GRACE}:tab-1`, ["camera"]);
    connection.applyAudience(audience([GRACE], [[GRACE, "low"]]));

    room.leave(grace);
    room.arrive(`${GRACE}:tab-1`, ["camera"]);

    expect(livekit.qualities).toEqual([
      { identity: `${GRACE}:tab-1`, quality: "LOW" },
      { identity: `${GRACE}:tab-1`, quality: "LOW" },
    ]);
  });

  // The SFU forgets a track's settings once it unsubscribes, and LiveKit stays
  // quiet about a layer it already asked for.
  it("asks for a camera's layer again when its tile comes back", async () => {
    const { connection, livekit, room } = await joinedRoom();
    room.join(`${GRACE}:tab-1`, ["camera"]);
    connection.applyAudience(audience([GRACE], [[GRACE, "low"]]));
    connection.applyAudience(audience([GRACE]));

    connection.applyAudience(audience([GRACE], [[GRACE, "low"]]));

    expect(livekit.qualities).toEqual([
      { identity: `${GRACE}:tab-1`, quality: "LOW" },
      { identity: `${GRACE}:tab-1`, quality: "LOW" },
    ]);
  });

  it("asks for a new layer once when a tile comes back at another size", async () => {
    const { connection, livekit, room } = await joinedRoom();
    room.join(`${GRACE}:tab-1`, ["camera"]);
    connection.applyAudience(audience([GRACE], [[GRACE, "low"]]));
    connection.applyAudience(audience([GRACE]));

    connection.applyAudience(audience([GRACE], [[GRACE, "medium"]]));

    expect(livekit.qualities).toEqual([
      { identity: `${GRACE}:tab-1`, quality: "LOW" },
      { identity: `${GRACE}:tab-1`, quality: "MEDIUM" },
    ]);
  });

  it.each([
    {
      source: "microphone",
      wanted: audience([GRACE]),
      firstReport: "onFirstRemoteAudio",
    },
    {
      source: "camera",
      wanted: audience([GRACE], [[GRACE, "low"]]),
      firstReport: "onFirstRemoteVideo",
    },
  ] as const)(
    "hands over a $source that arrived while briefly unwanted, once it is wanted again",
    async ({ firstReport, source, wanted }) => {
      const { connection, events, room } = await joinedRoom();
      const grace = room.join(`${GRACE}:tab-1`, [source]);
      connection.applyAudience(wanted);
      connection.applyAudience(audience([]));
      const track = room.deliver(grace, source);

      connection.applyAudience(wanted);
      connection.applyAudience(wanted);

      expect(events.onRemotePublicationChange).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          publication: expect.objectContaining({
            track: track.mediaStreamTrack,
          }),
        }),
      );
      expect(events[firstReport]).toHaveBeenCalledOnce();
    },
  );

  it("tells the media session when a microphone mutes and unmutes, keeping its stream", async () => {
    const { connection, events, room } = await joinedRoom();
    const grace = room.join(`${GRACE}:tab-1`, ["microphone"]);
    connection.applyAudience(audience([GRACE]));
    room.deliver(grace, "microphone");

    room.mute(grace, "microphone", true);
    room.mute(grace, "microphone", false);

    const handovers = events.onRemotePublicationChange.mock.calls.map(
      ([change]) => (change.type === "upserted" ? change.publication : null),
    );
    expect(handovers.map((publication) => publication?.enabled)).toEqual([
      true,
      false,
      true,
    ]);
    expect(
      new Set(handovers.map((publication) => publication?.stream)).size,
    ).toBe(1);
  });

  it("tells the media session when a subscribed camera mutes and unmutes", async () => {
    const { connection, events, room } = await joinedRoom();
    const grace = room.join(`${GRACE}:tab-1`, ["camera"]);
    connection.applyAudience(audience([GRACE], [[GRACE, "low"]]));
    room.deliver(grace, "camera");

    room.mute(grace, "camera", true);
    room.mute(grace, "camera", false);

    const enabled = events.onRemotePublicationChange.mock.calls.map(
      ([change]) => change.type === "upserted" && change.publication.enabled,
    );
    expect(enabled).toEqual([true, false, true]);
  });

  it("reports the room's first camera once, timed from its ask, with the link quality", async () => {
    let clock = 0;
    const { connection, events, room } = await joinedRoom(() => clock);
    const grace = room.join(`${GRACE}:tab-1`, ["microphone", "camera"]);
    const alan = room.join(`${ALAN}:tab-1`, ["camera"]);
    room.localParticipant.connectionQuality = "good";
    clock = 100;
    connection.applyAudience(
      audience(
        [GRACE, ALAN],
        [
          [GRACE, "low"],
          [ALAN, "low"],
        ],
      ),
    );

    clock = 340;
    room.deliver(grace, "microphone");
    room.deliver(grace, "camera");
    room.deliver(alan, "camera");

    expect(events.onFirstRemoteVideo).toHaveBeenCalledExactlyOnceWith({
      connectionQuality: "good",
      waitedMs: 240,
    });
  });

  describe("someone else's screen", () => {
    const SCREEN = `${GRACE}:tab-1-screen_share`;

    function isDesired(participant: FakeRemoteParticipant, sid: string) {
      return participant.trackPublications.get(sid)?.isDesired;
    }

    it("subscribes a screen only while its tile is on screen, apart from the camera", async () => {
      const { connection, room } = await joinedRoom();
      const grace = room.join(`${GRACE}:tab-1`, ["camera", "screen_share"]);
      const camera = `${GRACE}:tab-1-camera`;

      connection.applyAudience(audience([GRACE], [[GRACE, "low"]]));
      expect([isDesired(grace, camera), isDesired(grace, SCREEN)]).toEqual([
        true,
        false,
      ]);

      connection.applyAudience(audience([GRACE], [], [[GRACE, "low"]]));
      expect([isDesired(grace, camera), isDesired(grace, SCREEN)]).toEqual([
        false,
        true,
      ]);

      connection.applyAudience(audience([GRACE]));
      expect([isDesired(grace, camera), isDesired(grace, SCREEN)]).toEqual([
        false,
        false,
      ]);
    });

    it("never subscribes the audio of a share", async () => {
      const { connection, livekit, room } = await joinedRoom();
      room.join(`${GRACE}:tab-1`, ["screen_share_audio"]);

      connection.applyAudience(
        audience([GRACE], [[GRACE, "high"]], [[GRACE, "high"]]),
      );

      expect(livekit.subscriptions).toEqual([]);
    });

    it("hands a subscribed screen to the media session as a screen", async () => {
      const { connection, events, room } = await joinedRoom();
      const grace = room.join(`${GRACE}:tab-1`, ["screen_share"]);
      connection.applyAudience(audience([GRACE], [], [[GRACE, "low"]]));

      const track = room.deliver(grace, "screen_share");

      expect(track.mediaStreamTrack.kind).toBe("video");
      expect(events.onRemotePublicationChange).toHaveBeenCalledExactlyOnceWith({
        publication: expect.objectContaining({
          participantId: GRACE,
          publicationId: SCREEN,
          source: "screen",
          track: track.mediaStreamTrack,
        }),
        type: "upserted",
      });
    });

    it("reports neither first audio nor first video for a screen", async () => {
      const { connection, events, room } = await joinedRoom();
      const grace = room.join(`${GRACE}:tab-1`, ["screen_share"]);
      connection.applyAudience(audience([GRACE], [], [[GRACE, "low"]]));

      room.deliver(grace, "screen_share");

      expect(events.onFirstRemoteAudio).not.toHaveBeenCalled();
      expect(events.onFirstRemoteVideo).not.toHaveBeenCalled();
    });

    it("asks for a screen's layer as its tile changes size", async () => {
      const { connection, livekit, room } = await joinedRoom();
      room.join(`${GRACE}:tab-1`, ["screen_share"]);

      connection.applyAudience(audience([GRACE], [], [[GRACE, "low"]]));
      connection.applyAudience(audience([GRACE], [], [[GRACE, "high"]]));

      expect(livekit.qualities).toEqual([
        { identity: `${GRACE}:tab-1`, quality: "LOW" },
        { identity: `${GRACE}:tab-1`, quality: "HIGH" },
      ]);
    });

    it("tells the media session when a subscribed screen mutes", async () => {
      const { connection, events, room } = await joinedRoom();
      const grace = room.join(`${GRACE}:tab-1`, ["screen_share"]);
      connection.applyAudience(audience([GRACE], [], [[GRACE, "low"]]));
      room.deliver(grace, "screen_share");

      room.mute(grace, "screen_share", true);

      expect(events.onRemotePublicationChange).toHaveBeenLastCalledWith({
        publication: expect.objectContaining({
          enabled: false,
          source: "screen",
        }),
        type: "upserted",
      });
    });

    it("removes a screen that is unpublished", async () => {
      const { connection, events, room } = await joinedRoom();
      const grace = room.join(`${GRACE}:tab-1`, ["screen_share"]);
      connection.applyAudience(audience([GRACE], [], [[GRACE, "low"]]));
      room.deliver(grace, "screen_share");

      room.unpublish(grace, "screen_share");

      expect(events.onRemotePublicationChange).toHaveBeenLastCalledWith({
        participantId: GRACE,
        publicationId: SCREEN,
        source: "screen",
        type: "removed",
      });
    });

    it("reports a share already in the room once its owner is met, before anything subscribes", async () => {
      const { connection, events, livekit, room } = await joinedRoom();
      room.join(`${GRACE}:tab-1`, ["screen_share"]);

      connection.applyAudience(audience([GRACE]));

      expect(events.onRemoteScreenSharesChange).toHaveBeenCalledExactlyOnceWith(
        new Set([GRACE]),
      );
      expect(livekit.subscriptions).toEqual([]);
    });

    it("reports a share published after the member met its owner", async () => {
      const { connection, events, room } = await joinedRoom();
      connection.applyAudience(audience([GRACE]));

      room.arrive(`${GRACE}:tab-1`, ["screen_share"]);

      expect(events.onRemoteScreenSharesChange).toHaveBeenLastCalledWith(
        new Set([GRACE]),
      );
    });

    it("never reports the share of someone the member does not meet", async () => {
      const { connection, events, room } = await joinedRoom();
      connection.applyAudience(audience([GRACE]));

      room.arrive(`${ALAN}:tab-1`, ["screen_share"]);

      expect(events.onRemoteScreenSharesChange).not.toHaveBeenCalled();
    });

    it.each<{
      name: string;
      end: (
        connection: MeetingRoomConnection,
        room: FakeRoom,
        grace: FakeRemoteParticipant,
      ) => void;
    }>([
      {
        name: "is unpublished",
        end: (_connection, room, grace) =>
          room.unpublish(grace, "screen_share"),
      },
      {
        name: "leaves with its owner",
        end: (_connection, room, grace) => room.leave(grace),
      },
      {
        name: "belongs to someone the member stops meeting",
        end: (connection) => connection.applyAudience(audience([])),
      },
    ])("stops reporting a share that $name", async ({ end }) => {
      const { connection, events, room } = await joinedRoom();
      const grace = room.join(`${GRACE}:tab-1`, ["screen_share"]);
      connection.applyAudience(audience([GRACE]));

      end(connection, room, grace);

      expect(events.onRemoteScreenSharesChange).toHaveBeenLastCalledWith(
        new Set(),
      );
    });

    it("reports who is sharing only when it changes", async () => {
      const { connection, events, room } = await joinedRoom();
      room.join(`${GRACE}:tab-1`, ["microphone", "screen_share"]);

      connection.applyAudience(audience([GRACE]));
      connection.applyAudience(audience([GRACE], [[GRACE, "low"]]));

      expect(events.onRemoteScreenSharesChange).toHaveBeenCalledOnce();
    });
  });

  it("reports first remote audio for a microphone, never a camera", async () => {
    const { connection, events, room } = await joinedRoom();
    const grace = room.join(`${GRACE}:tab-1`, ["camera"]);
    connection.applyAudience(audience([GRACE], [[GRACE, "low"]]));

    room.deliver(grace, "camera");

    expect(events.onFirstRemoteAudio).not.toHaveBeenCalled();
  });

  it("reports the room's first remote audio once", async () => {
    const { connection, events, room } = await joinedRoom();
    const grace = room.join(`${GRACE}:tab-1`, ["microphone"]);
    const alan = room.join(`${ALAN}:tab-1`, ["microphone"]);
    connection.applyAudience(audience([GRACE, ALAN]));

    room.deliver(grace, "microphone");
    room.deliver(alan, "microphone");

    expect(events.onFirstRemoteAudio).toHaveBeenCalledOnce();
  });

  it("drops a microphone that arrives after its participant left the ask", async () => {
    const { connection, events, room } = await joinedRoom();
    const grace = room.join(`${GRACE}:tab-1`, ["microphone"]);
    connection.applyAudience(audience([GRACE]));
    connection.applyAudience(audience([]));

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
    connection.applyAudience(audience([GRACE]));
    room.deliver(grace, "microphone");
    connection.applyAudience(audience([]));

    end(room, grace);

    expect(events.onRemotePublicationChange).toHaveBeenLastCalledWith({
      participantId: GRACE,
      publicationId: `${GRACE}:tab-1-microphone`,
      source: "microphone",
      type: "removed",
    });
    expect(events.onRemotePublicationChange).toHaveBeenCalledTimes(2);
  });

  it.each(["microphone", "camera"] as const)(
    "publishes a copy of the member's %s as that source, never the track itself",
    async (source) => {
      const { connection, room } = await joinedRoom();
      const capture = localCapture(source, `${source}-1`);

      await addCapture(connection, capture);

      expect(room.published).toEqual([
        expect.objectContaining({ options: { source }, track: capture.copy }),
      ]);
    },
  );

  it("publishes a copy of the member's screen as a screen share, encoded for 1080p at 15 fps", async () => {
    const { connection, livekit, room } = await joinedRoom();
    const capture = localCapture("screen", "screen-1");

    await addCapture(connection, capture);

    expect(room.published).toEqual([
      expect.objectContaining({
        options: {
          screenShareEncoding:
            livekit.module.ScreenSharePresets.h1080fps15.encoding,
          source: "screen_share",
        },
        track: capture.copy,
      }),
    ]);
  });

  it("keeps a screen's content hint on the copy it publishes", async () => {
    const { connection } = await joinedRoom();
    const capture = localCapture("screen", "screen-1");
    capture.track.contentHint = "detail";

    await addCapture(connection, capture);

    expect(capture.copy.contentHint).toBe("detail");
  });

  it("publishes a screen beside the camera, and takes down only the screen", async () => {
    const { connection, room } = await joinedRoom();
    const camera = localCapture("camera", "camera-1");
    const screen = localCapture("screen", "screen-1");
    await addCapture(connection, camera);
    await addCapture(connection, screen);

    await removeCapture(connection, screen);

    expect(room.unpublished).toEqual([{ stop: false, track: screen.copy }]);
    expect(runningCopies(camera, screen)).toEqual([camera]);
  });

  it("stops the screen's copy when the room refuses to publish it", async () => {
    const { connection, room } = await joinedRoom();
    const screen = localCapture("screen", "screen-1");
    room.publishFails = true;

    await expect(addCapture(connection, screen)).rejects.toThrow();
    expect(runningCopies(screen)).toEqual([]);
  });

  it("stops the screen's copy even when taking it down fails", async () => {
    const { connection, room } = await joinedRoom();
    const screen = localCapture("screen", "screen-1");
    await addCapture(connection, screen);
    room.unpublishFails = true;

    await expect(removeCapture(connection, screen)).rejects.toThrow();
    expect(runningCopies(screen)).toEqual([]);
  });

  it("stops a screen's copy when the member leaves the room", async () => {
    const { connection } = await joinedRoom();
    const screen = localCapture("screen", "screen-1");
    await addCapture(connection, screen);

    await connection.disconnect();

    expect(runningCopies(screen)).toEqual([]);
  });

  it("reports a share's first viewer once, timed from the publish, with the link quality", async () => {
    let clock = 100;
    const { connection, events, room } = await joinedRoom(() => clock);
    room.localParticipant.connectionQuality = "good";
    await addCapture(connection, localCapture("screen", "screen-1"));
    clock = 340;

    room.viewerSubscribes("screen_share");
    room.viewerSubscribes("screen_share");

    expect(events.onFirstScreenViewer).toHaveBeenCalledExactlyOnceWith({
      connectionQuality: "good",
      waitedMs: 240,
    });
  });

  it("reports the first viewer of each new share", async () => {
    const { connection, events, room } = await joinedRoom();
    const first = localCapture("screen", "screen-1");
    await addCapture(connection, first);
    room.viewerSubscribes("screen_share");
    await removeCapture(connection, first);

    await addCapture(connection, localCapture("screen", "screen-2"));
    room.viewerSubscribes("screen_share");

    expect(events.onFirstScreenViewer).toHaveBeenCalledTimes(2);
  });

  it("does not take a viewer of the camera for a viewer of the share", async () => {
    const { connection, events, room } = await joinedRoom();
    await addCapture(connection, localCapture("screen", "screen-1"));

    room.viewerSubscribes("camera");

    expect(events.onFirstScreenViewer).not.toHaveBeenCalled();
  });

  it("turns the microphone off without touching the camera", async () => {
    const { connection, room } = await joinedRoom();
    const microphone = localMicrophone("mic-1");
    const camera = localCapture("camera", "camera-1");
    await addCapture(connection, microphone);
    await addCapture(connection, camera);

    await removeCapture(connection, microphone);

    expect(room.unpublished).toEqual([{ stop: false, track: microphone.copy }]);
    expect(runningCopies(microphone, camera)).toEqual([camera]);
  });

  it.each(["microphone", "camera"] as const)(
    "swaps in a copy of the new %s and stops the old copy",
    async (source) => {
      const { connection, room } = await joinedRoom();
      const first = localCapture(source, `${source}-1`);
      const second = localCapture(source, `${source}-2`);
      await addCapture(connection, first);

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
    },
  );

  it("stops its copy when the room refuses to publish the microphone", async () => {
    const { connection, room } = await joinedRoom();
    const microphone = localMicrophone("mic-1");
    room.publishFails = true;

    await expect(addCapture(connection, microphone)).rejects.toThrow();
    expect(runningCopies(microphone)).toEqual([]);
  });

  // The member switched away from the old device, so it must not keep sending.
  it.each(["microphone", "camera"] as const)(
    "takes the old %s off the call and stops both copies when the swap fails",
    async (source) => {
      const { connection, room } = await joinedRoom();
      const first = localCapture(source, `${source}-1`);
      const second = localCapture(source, `${source}-2`);
      await addCapture(connection, first);
      const published = publishedAt(room, 0);
      published.replaceTrack.mockRejectedValueOnce(new Error("swap failed"));

      await expect(
        connection.handleLocalPublicationChange({
          previousTrack: first.track,
          publication: second.publication,
          type: "replaced",
        }),
      ).rejects.toThrow("swap failed");

      expect(room.unpublished).toEqual([{ stop: false, track: published }]);
      expect(runningCopies(first, second)).toEqual([]);
    },
  );

  it.each(["microphone", "camera"] as const)(
    "unpublishes and stops the copy when the %s turns off",
    async (source) => {
      const { connection, room } = await joinedRoom();
      const capture = localCapture(source, `${source}-1`);
      await addCapture(connection, capture);

      await removeCapture(connection, capture);

      expect(room.unpublished).toEqual([{ stop: false, track: capture.copy }]);
      expect(capture.copy.stop).toHaveBeenCalledOnce();
      expect(capture.track.stop).not.toHaveBeenCalled();
    },
  );

  it.each(["microphone", "camera"] as const)(
    "stops the copy even when turning the %s off fails",
    async (source) => {
      const { connection, room } = await joinedRoom();
      const capture = localCapture(source, `${source}-1`);
      await addCapture(connection, capture);
      room.unpublishFails = true;

      await expect(removeCapture(connection, capture)).rejects.toThrow();

      expect(runningCopies(capture)).toEqual([]);
    },
  );

  it("turns the microphone off even while its publish is still in flight", async () => {
    const { connection, room } = await joinedRoom();
    const microphone = localMicrophone("mic-1");

    await Promise.all([
      addCapture(connection, microphone),
      removeCapture(connection, microphone),
    ]);

    expect(room.unpublished).toEqual([{ stop: false, track: microphone.copy }]);
  });

  it("leaves by disconnecting the room and stopping every copy, without reporting a drop", async () => {
    const { connection, events, room } = await joinedRoom();
    const microphone = localMicrophone("mic-1");
    const camera = localCapture("camera", "camera-1");
    await addCapture(connection, microphone);
    await addCapture(connection, camera);

    await connection.disconnect();

    expect(room.disconnectCalls).toEqual([true]);
    expect(runningCopies(microphone, camera)).toEqual([]);
    expect(microphone.track.stop).not.toHaveBeenCalled();
    expect(camera.track.stop).not.toHaveBeenCalled();
    expect(events.onDisconnected).not.toHaveBeenCalled();
  });

  it("leaves no copy running, even of microphone changes still in flight when it leaves", async () => {
    const { connection, room } = await joinedRoom();
    const first = localMicrophone("mic-1");
    const second = localMicrophone("mic-2");
    const release = room.holdPublishes();
    const changes = [
      addCapture(connection, first),
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
    await addCapture(connection, microphone);
    room.disconnectFails = true;

    await expect(connection.disconnect()).resolves.toBeUndefined();
    expect(microphone.copy.stop).toHaveBeenCalledOnce();
  });

  it("reports a drop the member did not ask for", async () => {
    const { events, room } = await joinedRoom();

    room.emit("disconnected");

    expect(events.onDisconnected).toHaveBeenCalledOnce();
  });

  it("still stops every copy when leaving, again and again, after a drop it reported", async () => {
    const { connection, events, room } = await joinedRoom();
    const microphone = localMicrophone("mic-1");
    await addCapture(connection, microphone);
    room.emit("disconnected");

    await expect(connection.disconnect()).resolves.toBeUndefined();
    await expect(connection.disconnect()).resolves.toBeUndefined();

    expect(microphone.copy.stop).toHaveBeenCalledOnce();
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
