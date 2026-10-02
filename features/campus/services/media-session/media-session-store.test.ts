import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  LocalPublicationChange,
  MeetingMediaTransport,
  RemotePublicationChange,
} from "./contracts";
import { createMediaSessionStore } from "./media-session-store";

type TestTrack = MediaStreamTrack &
  Readonly<{ stop: ReturnType<typeof vi.fn> }>;

function createTrack(kind: "audio" | "video", deviceId: string): TestTrack {
  const target = new EventTarget();
  const stop = vi.fn();

  return Object.assign(target, {
    enabled: true,
    getSettings: () => ({ deviceId }),
    kind,
    readyState: "live",
    stop,
  }) as unknown as TestTrack;
}

function createStream(tracks: readonly MediaStreamTrack[] = []): MediaStream {
  const ownedTracks = [...tracks];

  return {
    addTrack: (track: MediaStreamTrack) => ownedTracks.push(track),
    getAudioTracks: () => ownedTracks.filter((track) => track.kind === "audio"),
    getTracks: () => [...ownedTracks],
    getVideoTracks: () => ownedTracks.filter((track) => track.kind === "video"),
    removeTrack: (track: MediaStreamTrack) => {
      const index = ownedTracks.indexOf(track);
      if (index >= 0) ownedTracks.splice(index, 1);
    },
  } as unknown as MediaStream;
}

function createDevice(
  deviceId: string,
  kind: MediaDeviceKind,
  label: string,
): MediaDeviceInfo {
  const device = { deviceId, groupId: `${deviceId}-group`, kind, label };
  return { ...device, toJSON: () => device } as MediaDeviceInfo;
}

function createMediaDevices(
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
) {
  return Object.assign(new EventTarget(), {
    enumerateDevices: vi
      .fn()
      .mockResolvedValue([
        createDevice("camera-1", "videoinput", "Studio Camera"),
        createDevice("microphone-1", "audioinput", "Studio Microphone"),
        createDevice("speaker-1", "audiooutput", "Studio Speakers"),
      ]),
    getUserMedia: vi.fn(getUserMedia),
  }) as unknown as MediaDevices;
}

function storeMediaControlPreferences(
  cameraEnabled: boolean,
  microphoneEnabled: boolean,
) {
  window.localStorage.setItem(
    "campus-media-control-preferences",
    JSON.stringify({ cameraEnabled, microphoneEnabled }),
  );
}

function createTransport() {
  const changes: LocalPublicationChange[] = [];
  let remoteListener: ((change: RemotePublicationChange) => void) | undefined;
  const transport: MeetingMediaTransport = {
    handleLocalPublicationChange: (change) => changes.push(change),
    subscribeToRemotePublications(listener) {
      remoteListener = listener;
      return () => {
        remoteListener = undefined;
      };
    },
  };

  return {
    changes,
    emitRemote: (change: RemotePublicationChange) => remoteListener?.(change),
    transport,
  };
}

describe("media session store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts with camera and microphone off when no preference is stored", async () => {
    const mediaDevices = createMediaDevices(async () => createStream());
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
    });

    await store.getState().start();

    expect(mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(store.getState().camera).toMatchObject({
      desiredEnabled: false,
      status: "disabled",
      track: null,
    });
    expect(store.getState().microphone).toMatchObject({
      desiredEnabled: false,
      status: "disabled",
      track: null,
    });
    expect(store.getState().localPublications).toEqual({});
  });

  it("restores explicitly enabled sources from local preferences", async () => {
    storeMediaControlPreferences(true, false);
    const camera = createTrack("video", "camera-1");
    const mediaDevices = createMediaDevices(async () => createStream([camera]));
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
    });

    expect(store.getState().camera).toMatchObject({
      desiredEnabled: false,
      status: "disabled",
      track: null,
    });

    await store.getState().start();

    expect(mediaDevices.getUserMedia).toHaveBeenCalledOnce();
    expect(store.getState().camera).toMatchObject({
      desiredEnabled: true,
      status: "ready",
      track: camera,
    });
    expect(store.getState().microphone).toMatchObject({
      desiredEnabled: false,
      status: "disabled",
      track: null,
    });
  });

  it("persists enabled intent when sources are toggled on", async () => {
    const camera = createTrack("video", "camera-1");
    const microphone = createTrack("audio", "microphone-1");
    const mediaDevices = createMediaDevices(async (constraints) =>
      createStream([constraints.video ? camera : microphone]),
    );
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
    });
    await store.getState().start();

    await store.getState().toggleSource("camera");
    await store.getState().toggleSource("microphone");

    expect(
      window.localStorage.getItem("campus-media-control-preferences"),
    ).toBe(
      JSON.stringify({
        cameraEnabled: true,
        microphoneEnabled: true,
      }),
    );
  });

  it("releases the camera when it is switched off", async () => {
    storeMediaControlPreferences(true, false);
    const camera = createTrack("video", "camera-1");
    const mediaDevices = createMediaDevices(async () => createStream([camera]));
    const { changes, transport } = createTransport();
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
      transport,
    });
    await store.getState().start();

    await store.getState().toggleSource("camera");

    expect(camera.stop).toHaveBeenCalledOnce();
    expect(store.getState().camera).toMatchObject({
      desiredEnabled: false,
      status: "disabled",
      track: null,
    });
    expect(store.getState().localPublications.camera).toBeUndefined();
    expect(changes.at(-1)).toMatchObject({
      previousTrack: camera,
      source: "camera",
      type: "removed",
    });
    expect(
      window.localStorage.getItem("campus-media-control-preferences"),
    ).toBe(
      JSON.stringify({
        cameraEnabled: false,
        microphoneEnabled: false,
      }),
    );
  });

  it("does not acquire an input selected while its source is off", async () => {
    const mediaDevices = createMediaDevices(async () =>
      createStream([createTrack("video", "camera-2")]),
    );
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
    });
    await store.getState().start();

    await store.getState().selectInputDevice("camera", "camera-2");

    expect(mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(store.getState().camera).toMatchObject({
      desiredEnabled: false,
      selectedDeviceId: "camera-2",
      status: "disabled",
      track: null,
    });
  });

  it("keeps microphone capture usable when camera permission is denied", async () => {
    storeMediaControlPreferences(true, true);
    const microphone = createTrack("audio", "microphone-1");
    const mediaDevices = createMediaDevices(async (constraints) => {
      if (constraints.video) {
        throw new DOMException("denied", "NotAllowedError");
      }

      return createStream([microphone]);
    });
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
    });

    await store.getState().start();

    expect(store.getState().camera.status).toBe("denied");
    expect(store.getState().microphone.status).toBe("ready");
    expect(store.getState().localPublications.microphone?.track).toBe(
      microphone,
    );
  });

  it("soft-mutes the microphone without reacquiring", async () => {
    storeMediaControlPreferences(false, true);
    const microphone = createTrack("audio", "microphone-1");
    const mediaDevices = createMediaDevices(async () =>
      createStream([microphone]),
    );
    const { changes, transport } = createTransport();
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
      transport,
    });
    await store.getState().start();
    const captureCount = vi.mocked(mediaDevices.getUserMedia).mock.calls.length;

    await store.getState().toggleSource("microphone");

    expect(microphone.enabled).toBe(false);
    expect(store.getState().microphone.status).toBe("disabled");
    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(captureCount);
    expect(changes.at(-1)).toMatchObject({
      enabled: false,
      source: "microphone",
      type: "enabled-changed",
    });
    expect(
      window.localStorage.getItem("campus-media-control-preferences"),
    ).toBe(
      JSON.stringify({
        cameraEnabled: false,
        microphoneEnabled: false,
      }),
    );
  });

  it("releases a camera acquired after it was switched off while pending", async () => {
    storeMediaControlPreferences(true, false);
    const camera = createTrack("video", "camera-1");
    const microphone = createTrack("audio", "microphone-1");
    let resolveCamera: ((stream: MediaStream) => void) | undefined;
    const mediaDevices = createMediaDevices(async (constraints) => {
      if (!constraints.video) return createStream([microphone]);

      return new Promise<MediaStream>((resolve) => {
        resolveCamera = resolve;
      });
    });
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
    });
    const startPromise = store.getState().start();

    await vi.waitFor(() => {
      expect(store.getState().camera.status).toBe("requesting");
    });
    await store.getState().toggleSource("camera");
    resolveCamera?.(createStream([camera]));
    await startPromise;

    expect(camera.stop).toHaveBeenCalledOnce();
    expect(store.getState().camera).toMatchObject({
      desiredEnabled: false,
      status: "disabled",
      track: null,
    });
    expect(store.getState().localPublications.camera).toBeUndefined();
  });

  it("replaces a selected camera transactionally and stops the previous track", async () => {
    storeMediaControlPreferences(true, true);
    const firstCamera = createTrack("video", "camera-1");
    const secondCamera = createTrack("video", "camera-2");
    const microphone = createTrack("audio", "microphone-1");
    const mediaDevices = createMediaDevices(async (constraints) => {
      if (!constraints.video) return createStream([microphone]);
      const requestedId = (constraints.video as MediaTrackConstraints).deviceId;
      return createStream([requestedId ? secondCamera : firstCamera]);
    });
    const { changes, transport } = createTransport();
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
      transport,
    });
    await store.getState().start();

    await store.getState().selectInputDevice("camera", "camera-2");

    expect(store.getState().camera.track).toBe(secondCamera);
    expect(store.getState().camera.selectedDeviceId).toBe("camera-2");
    expect(firstCamera.stop).toHaveBeenCalledOnce();
    expect(changes.find((change) => change.type === "replaced")).toMatchObject({
      previousTrack: firstCamera,
      publication: { track: secondCamera },
      type: "replaced",
    });
  });

  it("retains the current camera when replacement acquisition fails", async () => {
    storeMediaControlPreferences(true, true);
    const camera = createTrack("video", "camera-1");
    const microphone = createTrack("audio", "microphone-1");
    const mediaDevices = createMediaDevices(async (constraints) => {
      const requestedId = constraints.video
        ? (constraints.video as MediaTrackConstraints).deviceId
        : undefined;
      if (requestedId) throw new DOMException("busy", "NotReadableError");
      return createStream([constraints.video ? camera : microphone]);
    });
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
    });
    await store.getState().start();

    await store.getState().selectInputDevice("camera", "camera-2");

    expect(store.getState().camera.track).toBe(camera);
    expect(store.getState().camera.selectedDeviceId).toBe("camera-1");
    expect(camera.stop).not.toHaveBeenCalled();
  });

  it("falls back to the default camera when the selected device disappears", async () => {
    storeMediaControlPreferences(true, true);
    const firstCamera = createTrack("video", "camera-1");
    const fallbackCamera = createTrack("video", "camera-2");
    const microphone = createTrack("audio", "microphone-1");
    let useFallbackCamera = false;
    const mediaDevices = createMediaDevices(async (constraints) =>
      createStream([
        constraints.video
          ? useFallbackCamera
            ? fallbackCamera
            : firstCamera
          : microphone,
      ]),
    );
    const enumerateDevices = vi.mocked(mediaDevices.enumerateDevices);
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
    });
    await store.getState().start();

    useFallbackCamera = true;
    enumerateDevices.mockResolvedValue([
      createDevice("camera-2", "videoinput", "Fallback Camera"),
      createDevice("microphone-1", "audioinput", "Studio Microphone"),
    ]);
    mediaDevices.dispatchEvent(new Event("devicechange"));

    await vi.waitFor(() => {
      expect(store.getState().camera.track).toBe(fallbackCamera);
    });
    expect(store.getState().camera.selectedDeviceId).toBe("camera-2");
    expect(firstCamera.stop).toHaveBeenCalledOnce();
  });

  it("accepts screen publications through the backend transport port", async () => {
    const camera = createTrack("video", "camera-1");
    const microphone = createTrack("audio", "microphone-1");
    const screen = createTrack("video", "screen-1");
    const mediaDevices = createMediaDevices(async (constraints) =>
      createStream([constraints.video ? camera : microphone]),
    );
    const { emitRemote, transport } = createTransport();
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
      transport,
    });
    await store.getState().start();

    emitRemote({
      publication: {
        enabled: true,
        origin: "remote",
        participantId: "participant-2",
        publicationId: "screen-share-1",
        source: "screen",
        stream: createStream([screen]),
        track: screen,
      },
      type: "upserted",
    });

    expect(
      store.getState().remotePublications["participant-2"]?.screen,
    ).toMatchObject({
      participantId: "participant-2",
      publicationId: "screen-share-1",
      source: "screen",
    });

    emitRemote({
      participantId: "participant-2",
      publicationId: "screen-share-1",
      source: "screen",
      type: "removed",
    });

    expect(
      store.getState().remotePublications["participant-2"],
    ).toBeUndefined();
  });

  it("stops owned tracks and clears publications when the session ends", async () => {
    storeMediaControlPreferences(true, true);
    const camera = createTrack("video", "camera-1");
    const microphone = createTrack("audio", "microphone-1");
    const mediaDevices = createMediaDevices(async (constraints) =>
      createStream([constraints.video ? camera : microphone]),
    );
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
    });
    await store.getState().start();

    store.getState().stop();

    expect(camera.stop).toHaveBeenCalledOnce();
    expect(microphone.stop).toHaveBeenCalledOnce();
    expect(store.getState().localPublications).toEqual({});
  });
});
