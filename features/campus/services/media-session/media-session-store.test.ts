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

function hasExactDeviceConstraint(constraints: MediaStreamConstraints) {
  const { deviceId } = (constraints.video ||
    constraints.audio) as MediaTrackConstraints;
  return typeof deviceId === "object" && "exact" in deviceId;
}

// The browser answers each enumeration with the devices connected when it was
// asked; the test decides when, so answers can arrive out of order.
function answerEnumerationsOnDemand(mediaDevices: MediaDevices) {
  const pending: Array<() => void> = [];
  let connected: readonly MediaDeviceInfo[] = [];
  vi.mocked(mediaDevices.enumerateDevices).mockImplementation(() => {
    const devicesAtCall = connected;
    return new Promise((resolve) => {
      pending.push(() => resolve([...devicesAtCall]));
    });
  });

  return {
    connect(devices: readonly MediaDeviceInfo[]) {
      connected = devices;
    },
    async answerNewestFirst() {
      while (pending.length > 0) {
        pending.pop()?.();
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    },
  };
}

function createPermissionPlaceholders() {
  return [
    createDevice("", "audioinput", ""),
    createDevice("", "videoinput", ""),
    createDevice("", "audiooutput", ""),
  ];
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

  it("starts a new route session with sources off even when legacy enabled intent exists", async () => {
    storeMediaControlPreferences(true, true);
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

  it("restores selected devices without enabling capture", async () => {
    const firstMediaDevices = createMediaDevices(async () => createStream());
    const firstStore = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices: firstMediaDevices,
    });
    await firstStore.getState().start();

    await firstStore.getState().selectInputDevice("camera", "camera-1");
    await firstStore.getState().selectInputDevice("microphone", "microphone-1");
    firstStore.getState().selectOutputDevice("speaker-1");
    firstStore.getState().stop();

    const secondMediaDevices = createMediaDevices(async () => createStream());
    const secondStore = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices: secondMediaDevices,
    });
    await secondStore.getState().start();

    expect(secondMediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(secondStore.getState().camera).toMatchObject({
      desiredEnabled: false,
      selectedDeviceId: "camera-1",
      track: null,
    });
    expect(secondStore.getState().microphone).toMatchObject({
      desiredEnabled: false,
      selectedDeviceId: "microphone-1",
      track: null,
    });
    expect(secondStore.getState().output.selectedDeviceId).toBe("speaker-1");
  });

  it("releases the camera when it is switched off", async () => {
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

    const failure = await store
      .getState()
      .selectInputDevice("camera", "camera-2");

    expect(failure).toBeNull();
    expect(mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(store.getState().camera).toMatchObject({
      desiredEnabled: false,
      selectedDeviceId: "camera-2",
      status: "disabled",
      track: null,
    });
  });

  it("keeps microphone capture usable when camera permission is denied", async () => {
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
    const cameraFailure = await store.getState().toggleSource("camera");
    const microphoneFailure = await store.getState().toggleSource("microphone");

    expect(cameraFailure).toBe("permission-denied");
    expect(microphoneFailure).toBeNull();
    expect(store.getState().camera.status).toBe("denied");
    expect(store.getState().microphone.status).toBe("ready");
    expect(store.getState().localPublications.microphone?.track).toBe(
      microphone,
    );
  });

  it("releases the microphone and reacquires the selected device", async () => {
    const firstMicrophone = createTrack("audio", "microphone-1");
    const secondMicrophone = createTrack("audio", "microphone-1");
    const microphones = [firstMicrophone, secondMicrophone];
    const mediaDevices = createMediaDevices(async () =>
      createStream([microphones.shift()!]),
    );
    const { changes, transport } = createTransport();
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
      transport,
    });
    await store.getState().start();
    await store.getState().toggleSource("microphone");

    await store.getState().toggleSource("microphone");

    expect(firstMicrophone.stop).toHaveBeenCalledOnce();
    expect(store.getState().microphone).toMatchObject({
      desiredEnabled: false,
      selectedDeviceId: "microphone-1",
      status: "disabled",
      track: null,
    });
    expect(store.getState().localPublications.microphone).toBeUndefined();
    expect(changes.at(-1)).toMatchObject({
      previousTrack: firstMicrophone,
      source: "microphone",
      type: "removed",
    });

    await store.getState().toggleSource("microphone");

    expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    expect(mediaDevices.getUserMedia).toHaveBeenLastCalledWith({
      audio: expect.objectContaining({
        deviceId: { ideal: "microphone-1" },
      }),
      video: false,
    });
    expect(store.getState().microphone.track).toBe(secondMicrophone);
    expect(store.getState().localPublications.microphone?.track).toBe(
      secondMicrophone,
    );
    expect(changes.at(-1)).toMatchObject({
      publication: { track: secondMicrophone },
      type: "added",
    });
  });

  it("prefers a remembered microphone so a missing one cannot block the permission prompt", async () => {
    window.localStorage.setItem(
      "campus-media-device-preferences",
      JSON.stringify({ microphoneDeviceId: "unplugged-microphone" }),
    );
    const microphone = createTrack("audio", "microphone-1");
    const mediaDevices = createMediaDevices(async (constraints) => {
      if (hasExactDeviceConstraint(constraints)) {
        throw new DOMException("missing", "OverconstrainedError");
      }
      return createStream([microphone]);
    });
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
    });
    await store.getState().start();

    expect(await store.getState().toggleSource("microphone")).toBeNull();

    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({
        deviceId: { ideal: "unplugged-microphone" },
      }),
      video: false,
    });
    expect(store.getState().microphone).toMatchObject({
      error: null,
      selectedDeviceId: "microphone-1",
      status: "ready",
      track: microphone,
    });
  });

  it("switches a live microphone to the exact device picked from the list", async () => {
    const microphones = [
      createTrack("audio", "microphone-1"),
      createTrack("audio", "microphone-2"),
    ];
    const mediaDevices = createMediaDevices(async () =>
      createStream([microphones.shift()!]),
    );
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
    });
    await store.getState().start();
    await store.getState().toggleSource("microphone");

    await store.getState().selectInputDevice("microphone", "microphone-2");

    expect(mediaDevices.getUserMedia).toHaveBeenLastCalledWith({
      audio: expect.objectContaining({
        deviceId: { exact: "microphone-2" },
      }),
      video: false,
    });
    expect(store.getState().microphone.selectedDeviceId).toBe("microphone-2");
  });

  it("offers no device until permission reveals real ones", async () => {
    const microphone = createTrack("audio", "microphone-1");
    const mediaDevices = createMediaDevices(async () =>
      createStream([microphone]),
    );
    const enumerateDevices = vi.mocked(mediaDevices.enumerateDevices);
    enumerateDevices.mockResolvedValue(createPermissionPlaceholders());
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
    });
    await store.getState().start();

    await store.getState().refreshDevices();

    expect(store.getState().microphone).toMatchObject({
      devices: [],
      devicesRequirePermission: true,
      selectedDeviceId: "",
    });
    expect(store.getState().camera.devicesRequirePermission).toBe(true);
    expect(store.getState().output).toMatchObject({
      devices: [],
      selectedDeviceId: "",
    });

    enumerateDevices.mockResolvedValue([
      createDevice("microphone-1", "audioinput", "Studio Microphone"),
      createDevice("", "videoinput", ""),
      createDevice("speaker-1", "audiooutput", "Studio Speakers"),
    ]);

    expect(await store.getState().toggleSource("microphone")).toBeNull();

    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({ deviceId: undefined }),
      video: false,
    });
    expect(store.getState().microphone).toMatchObject({
      devices: [
        { id: "microphone-1", isDefault: false, label: "Studio Microphone" },
      ],
      devicesRequirePermission: false,
      selectedDeviceId: "microphone-1",
      status: "ready",
    });
    expect(store.getState().camera.devicesRequirePermission).toBe(true);
    expect(store.getState().output.selectedDeviceId).toBe("speaker-1");
  });

  it("releases a camera acquired after it was switched off while pending", async () => {
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
    await store.getState().start();
    const enableCamera = store.getState().toggleSource("camera");

    await vi.waitFor(() => {
      expect(store.getState().camera.status).toBe("requesting");
    });
    await store.getState().toggleSource("camera");
    resolveCamera?.(createStream([camera]));
    await enableCamera;

    expect(camera.stop).toHaveBeenCalledOnce();
    expect(store.getState().camera).toMatchObject({
      desiredEnabled: false,
      status: "disabled",
      track: null,
    });
    expect(store.getState().localPublications.camera).toBeUndefined();
  });

  it("replaces a selected camera transactionally and stops the previous track", async () => {
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
    await store.getState().toggleSource("camera");

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
    await store.getState().toggleSource("camera");

    const failure = await store
      .getState()
      .selectInputDevice("camera", "camera-2");

    expect(failure).toBe("device-unreadable");
    expect(store.getState().camera.track).toBe(camera);
    expect(store.getState().camera.selectedDeviceId).toBe("camera-1");
    expect(camera.stop).not.toHaveBeenCalled();
  });

  it("falls back to the default camera when the selected device disappears", async () => {
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
    await store.getState().toggleSource("camera");

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

  it("re-enables an unavailable camera once discovery lists a camera", async () => {
    const mediaDevices = createMediaDevices(async () => {
      throw new DOMException("missing", "NotFoundError");
    });
    const enumerateDevices = vi.mocked(mediaDevices.enumerateDevices);
    enumerateDevices.mockResolvedValue([]);
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
    });
    await store.getState().start();

    expect(await store.getState().toggleSource("camera")).toBe(
      "device-unavailable",
    );
    await store.getState().refreshDevices();
    expect(store.getState().camera).toMatchObject({
      error: "device-unavailable",
      status: "unavailable",
    });

    enumerateDevices.mockResolvedValue([
      createDevice("camera-1", "videoinput", "Studio Camera"),
    ]);
    mediaDevices.dispatchEvent(new Event("devicechange"));

    await vi.waitFor(() => {
      expect(store.getState().camera).toMatchObject({
        error: null,
        status: "disabled",
        track: null,
      });
    });
  });

  it("drops a stale camera selection when an unavailable camera recovers", async () => {
    const camera = createTrack("video", "camera-1");
    let isCameraConnected = false;
    const mediaDevices = createMediaDevices(async () => {
      if (!isCameraConnected) {
        throw new DOMException("missing", "NotFoundError");
      }
      return createStream([camera]);
    });
    const enumerateDevices = vi.mocked(mediaDevices.enumerateDevices);
    enumerateDevices.mockResolvedValue([]);
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
    });
    await store.getState().start();
    await store.getState().selectInputDevice("camera", "unplugged-camera");

    expect(await store.getState().toggleSource("camera")).toBe(
      "device-unavailable",
    );

    isCameraConnected = true;
    enumerateDevices.mockResolvedValue([
      createDevice("camera-1", "videoinput", "Studio Camera"),
    ]);
    await store.getState().refreshDevices();

    expect(store.getState().camera).toMatchObject({
      error: null,
      selectedDeviceId: "",
    });
    expect(await store.getState().toggleSource("camera")).toBeNull();
    expect(store.getState().camera.track).toBe(camera);
  });

  it("does not clear permission failures when devices are discovered", async () => {
    const mediaDevices = createMediaDevices(async () => {
      throw new DOMException("denied", "NotAllowedError");
    });
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
    });
    await store.getState().start();
    await store.getState().toggleSource("camera");

    await store.getState().refreshDevices();

    expect(store.getState().camera).toMatchObject({
      error: "permission-denied",
      status: "denied",
    });
  });

  it("shows the newest camera list when an older enumeration answers last", async () => {
    const mediaDevices = createMediaDevices(async () => createStream());
    const enumerations = answerEnumerationsOnDemand(mediaDevices);
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
    });
    await store.getState().start();
    const studioCamera = createDevice(
      "camera-1",
      "videoinput",
      "Studio Camera",
    );
    const deskCamera = createDevice("camera-2", "videoinput", "Desk Camera");

    enumerations.connect([studioCamera]);
    const olderRefresh = store.getState().refreshDevices();
    enumerations.connect([studioCamera, deskCamera]);
    const newerRefresh = store.getState().refreshDevices();
    await enumerations.answerNewestFirst();
    await Promise.all([olderRefresh, newerRefresh]);

    const cameraIds = store.getState().camera.devices.map(({ id }) => id);
    expect(cameraIds).toEqual(["camera-1", "camera-2"]);
  });

  it("ignores an enumeration that answers after the session stopped", async () => {
    const mediaDevices = createMediaDevices(async () => createStream());
    const enumerations = answerEnumerationsOnDemand(mediaDevices);
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
    });
    await store.getState().start();
    enumerations.connect([
      createDevice("camera-1", "videoinput", "Studio Camera"),
    ]);

    const refresh = store.getState().refreshDevices();
    store.getState().stop();
    await enumerations.answerNewestFirst();
    await refresh;

    expect(store.getState().camera.devices).toEqual([]);
    expect(store.getState().deviceDiscoveryStatus).toBe("idle");
  });

  it("keeps the last listed devices when a later enumeration fails", async () => {
    const mediaDevices = createMediaDevices(async () => createStream());
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
    });
    await store.getState().start();
    await store.getState().refreshDevices();

    vi.mocked(mediaDevices.enumerateDevices).mockRejectedValue(
      new DOMException("blocked", "NotAllowedError"),
    );
    await store.getState().refreshDevices();

    expect(store.getState().deviceDiscoveryStatus).toBe("failed");
    expect(store.getState().camera.devices).toEqual([
      { id: "camera-1", isDefault: false, label: "Studio Camera" },
    ]);
  });

  it("reports whether choosing a speaker failed", async () => {
    const selectAudioOutput = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("dismissed", "NotAllowedError"))
      .mockResolvedValueOnce(
        createDevice("speaker-1", "audiooutput", "Studio Speakers"),
      );
    const mediaDevices = Object.assign(
      createMediaDevices(async () => createStream()),
      { selectAudioOutput },
    );
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices,
    });
    await store.getState().start();

    expect(await store.getState().chooseAudioOutput()).toBe(
      "permission-denied",
    );
    expect(await store.getState().chooseAudioOutput()).toBeNull();
    expect(store.getState().output).toMatchObject({
      error: null,
      selectedDeviceId: "speaker-1",
    });
  });

  it("reports an unsupported speaker picker", async () => {
    const store = createMediaSessionStore({
      createMediaStream: () => createStream(),
      mediaDevices: createMediaDevices(async () => createStream()),
    });
    await store.getState().start();

    expect(await store.getState().chooseAudioOutput()).toBe("unsupported");
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

    store.getState().stop();

    expect(camera.stop).toHaveBeenCalledOnce();
    expect(microphone.stop).toHaveBeenCalledOnce();
    expect(store.getState().localPublications).toEqual({});
  });
});
