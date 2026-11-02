import { describe, expect, it, vi } from "vitest";

import {
  createTestMediaStream,
  createTestMediaTrack,
} from "../../testing/media-session-test-utils";
import type {
  LocalPublicationChange,
  MeetingMediaTransport,
  MeetingMediaTransportCallbacks,
} from "./contracts";
import { createMediaSessionStore } from "./media-session-store";

function screenTrack() {
  return createTestMediaTrack("video", "screen-1");
}

async function connectedStore() {
  const picker = Promise.withResolvers<MediaStream>();
  const getDisplayMedia = vi.fn(() => picker.promise);
  const mediaDevices = Object.assign(new EventTarget(), {
    enumerateDevices: vi.fn().mockResolvedValue([]),
    getDisplayMedia,
    getUserMedia: vi.fn(),
  }) as unknown as MediaDevices;
  const changes: LocalPublicationChange[] = [];
  const timeline: string[] = [];
  let callbacks: MeetingMediaTransportCallbacks | undefined;
  const transport: MeetingMediaTransport = {
    connect(next) {
      callbacks = next;
      return () => timeline.push("disconnected");
    },
    handleLocalPublicationChange(change) {
      changes.push(change);
      timeline.push(change.type);
    },
    retry: vi.fn(),
    setVideoDemand: vi.fn(),
  };
  const store = createMediaSessionStore({ mediaDevices, transport });
  await store.getState().start();
  store.getState().connect();

  async function pick(track: MediaStreamTrack) {
    picker.resolve(createTestMediaStream([track]));
    await picker.promise;
    await Promise.resolve();
  }

  async function share(track: MediaStreamTrack) {
    store.getState().toggleScreenShare();
    await pick(track);
  }

  return {
    callbacks: () => callbacks!,
    changes,
    getDisplayMedia,
    pick,
    picker,
    share,
    store,
    timeline,
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve));

describe("screen share in the media session", () => {
  it("opens the picker inside the member's click, for video only", async () => {
    const { getDisplayMedia, store } = await connectedStore();

    store.getState().toggleScreenShare();

    expect(getDisplayMedia).toHaveBeenCalledOnce();
    expect(getDisplayMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: false,
      }),
    );
    expect(store.getState().screenShare.status).toBe("requesting");
  });

  it("opens one picker however many times the member clicks", async () => {
    const { getDisplayMedia, store } = await connectedStore();

    store.getState().toggleScreenShare();
    store.getState().toggleScreenShare();

    expect(getDisplayMedia).toHaveBeenCalledOnce();
  });

  it("publishes the picked screen, hinted to keep text sharp", async () => {
    const { changes, share, store } = await connectedStore();
    const track = screenTrack();

    await share(track);

    expect(store.getState().screenShare.status).toBe("sharing");
    expect(track.contentHint).toBe("detail");
    expect(changes).toEqual([
      {
        publication: expect.objectContaining({
          origin: "local",
          source: "screen",
          track,
        }),
        type: "added",
      },
    ]);
  });

  it.each([
    ["stays silent when the picker is cancelled", "NotAllowedError", null],
    [
      "reports a capture that cannot start",
      "NotReadableError",
      "capture_failed",
    ],
  ] as const)("%s", async (_case, errorName, outcome) => {
    const { changes, picker, store } = await connectedStore();

    store.getState().toggleScreenShare();
    picker.reject(new DOMException("refused", errorName));
    await flush();

    expect(store.getState().screenShare).toEqual({ outcome, status: "idle" });
    expect(changes).toEqual([]);
  });

  it("stops capture when the member stops sharing", async () => {
    const { changes, share, store } = await connectedStore();
    const track = screenTrack();
    await share(track);

    store.getState().toggleScreenShare();

    expect(track.stop).toHaveBeenCalledOnce();
    expect(store.getState().screenShare).toEqual({
      outcome: "stopped",
      status: "idle",
    });
    expect(changes.at(-1)).toMatchObject({
      endReason: "stopped",
      previousTrack: track,
      source: "screen",
      type: "removed",
    });
  });

  it("follows the browser's own Stop sharing, and does not capture again", async () => {
    const { changes, getDisplayMedia, share, store } = await connectedStore();
    const track = screenTrack();
    await share(track);

    track.dispatchEvent(new Event("ended"));

    expect(store.getState().screenShare).toEqual({
      outcome: "browser_stopped",
      status: "idle",
    });
    expect(changes.at(-1)).toMatchObject({
      endReason: "browser_stopped",
      type: "removed",
    });
    expect(getDisplayMedia).toHaveBeenCalledOnce();
  });

  it.each(["meeting_ended", "room_closed", "publish_failed"] as const)(
    "stops capture when the call ends the share: %s",
    async (reason) => {
      const { callbacks, changes, share, store } = await connectedStore();
      const track = screenTrack();
      await share(track);

      callbacks().onScreenShareEnded(reason);

      expect(track.stop).toHaveBeenCalledOnce();
      expect(store.getState().screenShare).toEqual({
        outcome: reason,
        status: "idle",
      });
      expect(changes.at(-1)).toMatchObject({
        endReason: reason,
        type: "removed",
      });
    },
  );

  it("releases a share only once", async () => {
    const { callbacks, changes, share } = await connectedStore();
    const track = screenTrack();
    await share(track);

    callbacks().onScreenShareEnded("meeting_ended");
    callbacks().onScreenShareEnded("room_closed");
    track.dispatchEvent(new Event("ended"));

    expect(track.stop).toHaveBeenCalledOnce();
    expect(changes.filter(({ type }) => type === "removed")).toHaveLength(1);
  });

  it("stops a screen picked after the call moved on, unpublished and unannounced", async () => {
    const { callbacks, changes, pick, store } = await connectedStore();
    const track = screenTrack();
    store.getState().toggleScreenShare();

    callbacks().onScreenShareEnded("room_closed");
    await pick(track);

    expect(track.stop).toHaveBeenCalledOnce();
    expect(changes).toEqual([]);
    expect(store.getState().screenShare).toEqual({
      outcome: null,
      status: "idle",
    });
  });

  it("clears the last outcome when the member shares again", async () => {
    const { callbacks, share, store } = await connectedStore();
    await share(screenTrack());
    callbacks().onScreenShareEnded("meeting_ended");

    store.getState().toggleScreenShare();

    expect(store.getState().screenShare.outcome).toBeNull();
  });

  it("knows who else is sharing until the session ends", async () => {
    const { callbacks, store } = await connectedStore();

    callbacks().onRemoteScreenSharesChange(new Set(["participant-2"]));
    expect(store.getState().remoteScreenShares).toEqual(
      new Set(["participant-2"]),
    );

    store.getState().stop();
    expect(store.getState().remoteScreenShares).toEqual(new Set());
  });

  it("releases capture before the session disconnects the call", async () => {
    const { share, store, timeline } = await connectedStore();
    const track = screenTrack();
    await share(track);

    store.getState().stop();

    expect(track.stop).toHaveBeenCalledOnce();
    expect(timeline).toEqual(["added", "removed", "disconnected"]);
  });
});
