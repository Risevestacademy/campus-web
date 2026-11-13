import { createStore, type StoreApi } from "zustand/vanilla";

import type {
  AudioOutputState,
  BroadcastPublicationChange,
  BroadcastPublications,
  CallAudioStatus,
  CaptureSource,
  CaptureSourceState,
  DeviceAccessOutcome,
  DeviceCatalogSnapshot,
  DeviceDiscoveryStatus,
  LocalMediaPublication,
  LocalPublicationChange,
  MediaDeviceCatalog,
  MediaDeviceOption,
  MediaSessionErrorCode,
  MeetingMediaTransport,
  PublicationSource,
  RemoteAudioGains,
  RemotePublicationChange,
  RemotePublicationRegistry,
  ScreenShareState,
  VideoLayer,
  VideoSource,
} from "./contracts";
import { createDeviceCatalog, discoverMediaDevices } from "./device-discovery";
import {
  DEFAULT_MEDIA_DEVICE_PREFERENCES,
  loadMediaDevicePreferences,
  saveMediaDevicePreferences,
} from "./media-device-preferences";
import { noopMeetingMediaTransport } from "./meeting-media-transport";
import {
  removeRemotePublication,
  upsertRemotePublication,
} from "./publication-registry";
import { createScreenShare, IDLE_SCREEN_SHARE } from "./screen-share";
import { createVideoDemand } from "./video-demand";

type SelectableAudioOutputMediaDevices = MediaDevices &
  Readonly<{
    selectAudioOutput?: () => Promise<MediaDeviceInfo>;
  }>;

type MediaActionFailure = Promise<MediaSessionErrorCode | null>;

const NOBODY_SHARING: ReadonlySet<string> = new Set();

// A remembered selection may name a device that is gone or was never real, so
// it is only preferred: `exact` would reject before the permission prompt.
// `exact` is reserved for switching to a device the user picked from the list.
type DeviceRequest = Readonly<{
  deviceId: string;
  match: "exact" | "ideal";
}>;

export type MediaSessionState = Readonly<{
  broadcastPublications: BroadcastPublications;
  camera: CaptureSourceState;
  // The call refused the member's latest camera change.
  cameraPublishFailed: boolean;
  callAudioStatus: CallAudioStatus;
  chooseAudioOutput: () => MediaActionFailure;
  connect: () => void;
  // A tile showing a remote video; the returned function lets it go.
  demandVideo: (
    participantId: string,
    source: VideoSource,
    layer: VideoLayer,
  ) => () => void;
  deviceDiscoveryStatus: DeviceDiscoveryStatus;
  localPublications: Readonly<
    Partial<Record<PublicationSource, LocalMediaPublication>>
  >;
  microphone: CaptureSourceState;
  output: AudioOutputState;
  refreshDevices: () => Promise<void>;
  remoteAudioGains: RemoteAudioGains;
  remotePublications: RemotePublicationRegistry;
  remoteScreenShares: ReadonlySet<string>;
  // Obtains permission only: capture stays off until the member turns it on.
  requestDeviceAccess: () => Promise<DeviceAccessOutcome>;
  retryCallAudio: () => void;
  screenShare: ScreenShareState;
  selectInputDevice: (
    source: CaptureSource,
    deviceId: string,
  ) => MediaActionFailure;
  selectOutputDevice: (deviceId: string) => void;
  start: () => Promise<void>;
  stop: () => void;
  // Call it from the member's click: the browser opens its picker only then.
  toggleScreenShare: () => void;
  toggleSource: (source: CaptureSource) => MediaActionFailure;
}>;

type MediaSessionStoreDependencies = Readonly<{
  createMediaStream?: () => MediaStream;
  mediaDevices?: MediaDevices | null;
  transport?: MeetingMediaTransport;
}>;

function createInitialCaptureState(
  desiredEnabled: boolean,
  selectedDeviceId = "",
): CaptureSourceState {
  return {
    desiredEnabled,
    devices: [],
    devicesRequirePermission: false,
    error: null,
    selectedDeviceId,
    status: desiredEnabled ? "idle" : "disabled",
    track: null,
  };
}

function getErrorCode(error: unknown): MediaSessionErrorCode {
  if (!(error instanceof DOMException)) return "unknown";

  switch (error.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "permission-denied";
    case "NotFoundError":
    case "OverconstrainedError":
      return "device-unavailable";
    case "AbortError":
    case "NotReadableError":
      return "device-unreadable";
    default:
      return "unknown";
  }
}

function getFailureStatus(errorCode: MediaSessionErrorCode) {
  if (errorCode === "permission-denied") return "denied" as const;
  if (errorCode === "device-unavailable") return "unavailable" as const;
  return "failed" as const;
}

function getDeviceConstraint(request?: DeviceRequest) {
  if (!request?.deviceId) return undefined;

  return request.match === "exact"
    ? { exact: request.deviceId }
    : { ideal: request.deviceId };
}

function getConstraints(
  source: CaptureSource,
  request?: DeviceRequest,
): MediaStreamConstraints {
  const deviceConstraint = getDeviceConstraint(request);

  if (source === "camera") {
    return {
      audio: false,
      video: {
        deviceId: deviceConstraint,
        facingMode: { ideal: "user" },
        frameRate: { ideal: 30, max: 30 },
        height: { ideal: 720 },
        width: { ideal: 1280 },
      },
    };
  }

  return {
    audio: {
      autoGainControl: true,
      deviceId: deviceConstraint,
      echoCancellation: true,
      noiseSuppression: true,
    },
    video: false,
  };
}

function getTrack(stream: MediaStream, source: CaptureSource) {
  return source === "camera"
    ? stream.getVideoTracks()[0]
    : stream.getAudioTracks()[0];
}

function supportsAudioOutputSelection(mediaDevices: MediaDevices | undefined) {
  return (
    typeof (mediaDevices as SelectableAudioOutputMediaDevices | undefined)
      ?.selectAudioOutput === "function"
  );
}

// A missing device only blocks capture until discovery lists one again. A stale
// selection is dropped because its `exact` constraint would fail every retry.
function withDiscoveredDevices(
  source: CaptureSourceState,
  devices: readonly MediaDeviceOption[],
  devicesRequirePermission: boolean,
): CaptureSourceState {
  const canRecover =
    !source.track &&
    source.status !== "requesting" &&
    source.error === "device-unavailable" &&
    devices.length > 0;

  if (!canRecover) return { ...source, devices, devicesRequirePermission };

  const isSelectedDeviceListed = devices.some(
    (device) => device.id === source.selectedDeviceId,
  );

  return {
    ...source,
    devices,
    devicesRequirePermission,
    error: null,
    selectedDeviceId: isSelectedDeviceListed ? source.selectedDeviceId : "",
    status: "disabled",
  };
}

function createDefaultMediaStream() {
  if (typeof MediaStream !== "undefined") return new MediaStream();

  return {
    addTrack() {},
    getAudioTracks: () => [],
    getTracks: () => [],
    getVideoTracks: () => [],
    removeTrack() {},
  } as unknown as MediaStream;
}

export function createMediaSessionStore(
  dependencies: MediaSessionStoreDependencies = {},
): StoreApi<MediaSessionState> {
  const {
    createMediaStream = createDefaultMediaStream,
    transport = noopMeetingMediaTransport,
  } = dependencies;
  const mediaDevices = Object.hasOwn(dependencies, "mediaDevices")
    ? (dependencies.mediaDevices ?? undefined)
    : globalThis.navigator?.mediaDevices;
  let devicePreferences = DEFAULT_MEDIA_DEVICE_PREFERENCES;
  const localStream = createMediaStream();
  const operationVersions: Record<CaptureSource, number> = {
    camera: 0,
    microphone: 0,
  };
  const endedHandlers: Partial<Record<CaptureSource, (event: Event) => void>> =
    {};
  let started = false;
  let removeDeviceChangeListener: (() => void) | undefined;
  let disconnectTransport: (() => void) | undefined;
  let deviceAccessRequest: Promise<DeviceAccessOutcome> | undefined;
  let deviceAccessStream: MediaStream | undefined;
  // The Join Gate's child effect can request before the provider calls start().
  let deviceAccessStopped = false;
  let deviceAccessGeneration = 0;

  const store = createStore<MediaSessionState>((set, get) => {
    function persistInputDevicePreference(
      source: CaptureSource,
      deviceId: string,
    ) {
      devicePreferences =
        source === "camera"
          ? { ...devicePreferences, cameraDeviceId: deviceId }
          : { ...devicePreferences, microphoneDeviceId: deviceId };
      saveMediaDevicePreferences(devicePreferences);
    }

    function persistOutputDevicePreference(deviceId: string) {
      devicePreferences = {
        ...devicePreferences,
        speakerDeviceId: deviceId,
      };
      saveMediaDevicePreferences(devicePreferences);
    }

    function forwardLocalChange(change: LocalPublicationChange) {
      if (!disconnectTransport) return;
      transport.handleLocalPublicationChange(change);
    }

    const screenShare = createScreenShare({
      mediaDevices,
      onLocalChange: forwardLocalChange,
      onStateChange: (next) => set({ screenShare: next }),
    });

    function applyRemotePublicationChange(change: RemotePublicationChange) {
      set((state) => ({
        remotePublications:
          change.type === "upserted"
            ? upsertRemotePublication(
                state.remotePublications,
                change.publication,
              )
            : removeRemotePublication(state.remotePublications, change),
      }));
    }

    function applyBroadcastPublicationChange(
      change: BroadcastPublicationChange,
    ) {
      set(({ broadcastPublications }) => {
        if (change.type === "upserted") {
          const { participantId } = change.publication;
          return {
            broadcastPublications: {
              ...broadcastPublications,
              [participantId]: change.publication,
            },
          };
        }
        const { [change.participantId]: removed, ...others } =
          broadcastPublications;
        return removed?.publicationId === change.publicationId
          ? { broadcastPublications: others }
          : {};
      });
    }

    function updateSource(
      source: CaptureSource,
      update: Partial<CaptureSourceState>,
    ) {
      set((state) => ({
        [source]: { ...state[source], ...update },
      }));
    }

    function publishLocalTrack(
      source: CaptureSource,
      track: MediaStreamTrack,
      previousTrack: MediaStreamTrack | null,
    ) {
      const publication: LocalMediaPublication = {
        enabled: track.enabled,
        origin: "local",
        publicationId: `local-${source}`,
        source,
        stream: localStream,
        track,
      };

      set((state) => ({
        localPublications: {
          ...state.localPublications,
          [source]: publication,
        },
      }));

      forwardLocalChange(
        previousTrack
          ? { previousTrack, publication, type: "replaced" }
          : { publication, type: "added" },
      );
    }

    function removeLocalPublication(source: CaptureSource) {
      set((state) => {
        const { [source]: _removed, ...remainingPublications } =
          state.localPublications;
        return { localPublications: remainingPublications };
      });
    }

    function removeTrack(source: CaptureSource, track: MediaStreamTrack) {
      const endedHandler = endedHandlers[source];
      if (endedHandler) track.removeEventListener("ended", endedHandler);
      delete endedHandlers[source];
      localStream.removeTrack(track);
      track.stop();
      forwardLocalChange({
        previousTrack: track,
        publicationId: `local-${source}`,
        source,
        type: "removed",
      });
    }

    function applyDeviceCatalog(devices: MediaDeviceCatalog) {
      set((state) => {
        const defaultOutputDeviceId =
          devices.speakers.find((device) => device.isDefault)?.id ??
          devices.speakers[0]?.id ??
          "";
        const selectedOutputStillExists =
          !state.output.selectedDeviceId ||
          devices.speakers.some(
            (device) => device.id === state.output.selectedDeviceId,
          );

        return {
          camera: withDiscoveredDevices(
            state.camera,
            devices.cameras,
            devices.permissionRequired.cameras,
          ),
          deviceDiscoveryStatus: "ready",
          microphone: withDiscoveredDevices(
            state.microphone,
            devices.microphones,
            devices.permissionRequired.microphones,
          ),
          output: {
            ...state.output,
            devices: devices.speakers,
            error: null,
            selectedDeviceId: selectedOutputStillExists
              ? state.output.selectedDeviceId || defaultOutputDeviceId
              : defaultOutputDeviceId,
            status: state.output.supportsSelection ? "ready" : "unsupported",
          },
        };
      });
    }

    // A failed refresh keeps the last good device lists on screen.
    function applyCatalogSnapshot(snapshot: DeviceCatalogSnapshot) {
      switch (snapshot.status) {
        case "idle":
          set({ deviceDiscoveryStatus: "idle" });
          return;
        case "refreshing":
          set({ deviceDiscoveryStatus: "loading" });
          return;
        case "ready":
          applyDeviceCatalog(snapshot.catalog);
          return;
        case "stale":
        case "failed":
          set((state) => ({
            deviceDiscoveryStatus: "failed",
            output: { ...state.output, error: "unknown", status: "failed" },
          }));
      }
    }

    const deviceCatalog = mediaDevices
      ? createDeviceCatalog({ mediaDevices, onSnapshot: applyCatalogSnapshot })
      : null;

    async function refreshDevices() {
      if (!deviceCatalog) {
        set((state) => ({
          camera: {
            ...state.camera,
            error: "unsupported",
            status: state.camera.track ? state.camera.status : "failed",
          },
          microphone: {
            ...state.microphone,
            error: "unsupported",
            status: state.microphone.track ? state.microphone.status : "failed",
          },
          output: {
            ...state.output,
            error: "unsupported",
            status: "unsupported",
          },
          deviceDiscoveryStatus: "failed",
        }));
        return;
      }

      await deviceCatalog.refresh();
    }

    function releaseDeviceAccessCapture() {
      const stream = deviceAccessStream;
      deviceAccessStream = undefined;
      stream?.getTracks().forEach((track) => track.stop());
    }

    // Reads the browser directly: `stop()` resets the catalog, so a catalog
    // read would lose the answer to a session restart. Closing the prompt raises
    // the same error as blocking the site and a recorded denial disables the
    // toggle, so a failure here records nothing and the member's click still asks.
    async function askForMissingAccess(
      devices: MediaDevices,
    ): Promise<DeviceAccessOutcome> {
      const { permissionRequired } = await discoverMediaDevices(devices);
      if (deviceAccessStopped) return "cancelled";
      const { cameras: video, microphones: audio } = permissionRequired;
      if (!audio && !video) return "not_needed";

      let stream: MediaStream;
      try {
        stream = await devices.getUserMedia({ audio, video });
      } catch (error) {
        if (deviceAccessStopped) return "cancelled";
        return getErrorCode(error) === "permission-denied"
          ? "declined"
          : "failed";
      }

      deviceAccessStream = stream;
      try {
        if (deviceAccessStopped) return "cancelled";

        while (true) {
          const generation = deviceAccessGeneration;
          await refreshDevices();
          if (deviceAccessStopped) return "cancelled";
          // A restart invalidates the old catalog refresh, but shares the grant.
          if (generation === deviceAccessGeneration) return "granted";
        }
      } finally {
        releaseDeviceAccessCapture();
      }
    }

    async function acquireSource(
      source: CaptureSource,
      request?: DeviceRequest,
    ) {
      const operationVersion = ++operationVersions[source];
      const currentSource = get()[source];
      updateSource(source, { error: null, status: "requesting" });

      if (!mediaDevices) {
        updateSource(source, {
          desiredEnabled: false,
          error: "unsupported",
          status: "failed",
        });
        return;
      }

      try {
        const acquiredStream = await mediaDevices.getUserMedia(
          getConstraints(source, request),
        );
        const track = getTrack(acquiredStream, source);

        if (!track) {
          acquiredStream.getTracks().forEach((candidate) => candidate.stop());
          throw new DOMException(
            "Required track was not returned.",
            "NotFoundError",
          );
        }

        acquiredStream
          .getTracks()
          .filter((candidate) => candidate !== track)
          .forEach((candidate) => candidate.stop());

        if (!started || operationVersion !== operationVersions[source]) {
          track.stop();
          return;
        }

        const previousTrack = get()[source].track;
        if (previousTrack) {
          const previousEndedHandler = endedHandlers[source];
          if (previousEndedHandler) {
            previousTrack.removeEventListener("ended", previousEndedHandler);
          }
          localStream.removeTrack(previousTrack);
        }

        const desiredEnabled = get()[source].desiredEnabled;
        track.enabled = desiredEnabled;
        localStream.addTrack(track);

        const endedHandler = () => {
          if (!started || get()[source].track !== track) return;
          track.removeEventListener("ended", endedHandler);
          delete endedHandlers[source];
          localStream.removeTrack(track);
          updateSource(source, {
            error: "device-unavailable",
            status: "requesting",
            track: null,
          });
          removeLocalPublication(source);
          forwardLocalChange({
            previousTrack: track,
            publicationId: `local-${source}`,
            source,
            type: "removed",
          });
          void acquireSource(source);
        };

        endedHandlers[source] = endedHandler;
        track.addEventListener("ended", endedHandler);

        const selectedDeviceId =
          track.getSettings().deviceId ??
          request?.deviceId ??
          currentSource.selectedDeviceId;
        persistInputDevicePreference(source, selectedDeviceId);

        updateSource(source, {
          error: null,
          selectedDeviceId,
          status: desiredEnabled ? "ready" : "disabled",
          track,
        });
        publishLocalTrack(source, track, previousTrack);
        previousTrack?.stop();
        await refreshDevices();
      } catch (error) {
        if (!started || operationVersion !== operationVersions[source]) return;
        const errorCode = getErrorCode(error);
        const latestSource = get()[source];
        updateSource(
          source,
          latestSource.track
            ? {
                desiredEnabled: latestSource.desiredEnabled,
                error: errorCode,
                status: latestSource.track.enabled ? "ready" : "disabled",
                track: latestSource.track,
              }
            : {
                desiredEnabled: false,
                error: errorCode,
                status: getFailureStatus(errorCode),
              },
        );
      }
    }

    async function handleDeviceChange() {
      await refreshDevices();
      const state = get();

      for (const source of ["camera", "microphone"] as const) {
        const sourceState = state[source];
        if (
          sourceState.track &&
          sourceState.selectedDeviceId &&
          !sourceState.devices.some(
            (device) => device.id === sourceState.selectedDeviceId,
          )
        ) {
          await acquireSource(source);
        }
      }
    }

    return {
      broadcastPublications: {},
      camera: createInitialCaptureState(false),
      cameraPublishFailed: false,
      callAudioStatus: "idle",
      async chooseAudioOutput() {
        const selectableMediaDevices = mediaDevices as
          SelectableAudioOutputMediaDevices | undefined;

        if (!selectableMediaDevices?.selectAudioOutput) {
          set((state) => ({
            output: {
              ...state.output,
              error: "unsupported",
              status: "unsupported",
            },
          }));
          return "unsupported";
        }

        try {
          const device = await selectableMediaDevices.selectAudioOutput();
          await refreshDevices();
          persistOutputDevicePreference(device.deviceId);
          set((state) => ({
            output: {
              ...state.output,
              error: null,
              selectedDeviceId: device.deviceId,
              status: "ready",
            },
          }));
          return null;
        } catch (error) {
          const errorCode = getErrorCode(error);
          set((state) => ({
            output: {
              ...state.output,
              error: errorCode,
              status: "failed",
            },
          }));
          return errorCode;
        }
      },
      connect() {
        if (disconnectTransport) return;

        disconnectTransport = transport.connect({
          onBroadcastPublicationChange: applyBroadcastPublicationChange,
          onCameraPublishOutcome: (cameraPublishFailed) =>
            set({ cameraPublishFailed }),
          onRemoteAudioGainsChange: (remoteAudioGains) =>
            set({ remoteAudioGains }),
          onRemotePublicationChange: applyRemotePublicationChange,
          onRemoteScreenSharesChange: (remoteScreenShares) =>
            set({ remoteScreenShares }),
          onScreenShareEnded: screenShare.end,
          onStatusChange: (callAudioStatus) => set({ callAudioStatus }),
        });
        for (const publication of Object.values(get().localPublications)) {
          if (publication) forwardLocalChange({ publication, type: "added" });
        }
      },
      demandVideo: createVideoDemand((demand) =>
        transport.setVideoDemand(demand),
      ),
      deviceDiscoveryStatus: "idle",
      localPublications: {},
      microphone: createInitialCaptureState(false),
      output: {
        devices: [],
        error: null,
        selectedDeviceId: "",
        status: supportsAudioOutputSelection(mediaDevices)
          ? "idle"
          : "unsupported",
        supportsSelection: supportsAudioOutputSelection(mediaDevices),
      },
      refreshDevices,
      remoteAudioGains: {},
      remotePublications: {},
      remoteScreenShares: NOBODY_SHARING,
      requestDeviceAccess() {
        if (!mediaDevices) return Promise.resolve("unsupported");
        if (deviceAccessStopped && !deviceAccessRequest) {
          return Promise.resolve("cancelled");
        }

        deviceAccessRequest ??= askForMissingAccess(mediaDevices)
          .catch((): DeviceAccessOutcome =>
            deviceAccessStopped ? "cancelled" : "unsupported",
          )
          .finally(() => {
            deviceAccessRequest = undefined;
          });
        return deviceAccessRequest;
      },
      retryCallAudio() {
        if (disconnectTransport) transport.retry();
      },
      screenShare: IDLE_SCREEN_SHARE,
      async selectInputDevice(source, deviceId) {
        const sourceState = get()[source];
        if (!sourceState.desiredEnabled && !sourceState.track) {
          persistInputDevicePreference(source, deviceId);
          updateSource(source, {
            error: null,
            selectedDeviceId: deviceId,
            status: "disabled",
          });
          return null;
        }

        await acquireSource(source, { deviceId, match: "exact" });
        return get()[source].error;
      },
      selectOutputDevice(deviceId) {
        persistOutputDevicePreference(deviceId);
        set((state) => ({
          output: {
            ...state.output,
            error: null,
            selectedDeviceId: deviceId,
            status: state.output.supportsSelection ? "ready" : "unsupported",
          },
        }));
      },
      async start() {
        if (started) return;
        started = true;
        deviceAccessStopped = false;
        devicePreferences = loadMediaDevicePreferences();
        set((state) => ({
          camera: createInitialCaptureState(
            false,
            devicePreferences.cameraDeviceId,
          ),
          microphone: createInitialCaptureState(
            false,
            devicePreferences.microphoneDeviceId,
          ),
          output: {
            ...state.output,
            selectedDeviceId: devicePreferences.speakerDeviceId,
          },
        }));

        if (mediaDevices) {
          const deviceChangeHandler = () => void handleDeviceChange();
          mediaDevices.addEventListener("devicechange", deviceChangeHandler);
          removeDeviceChangeListener = () =>
            mediaDevices.removeEventListener(
              "devicechange",
              deviceChangeHandler,
            );
        }
      },
      stop() {
        deviceAccessStopped = true;
        deviceAccessGeneration += 1;
        releaseDeviceAccessCapture();
        deviceCatalog?.reset();
        screenShare.end("session_ended");
        disconnectTransport?.();
        disconnectTransport = undefined;
        if (!started) return;
        started = false;
        operationVersions.camera += 1;
        operationVersions.microphone += 1;
        removeDeviceChangeListener?.();
        removeDeviceChangeListener = undefined;

        for (const source of ["camera", "microphone"] as const) {
          const track = get()[source].track;
          if (track) removeTrack(source, track);
        }

        set({
          camera: createInitialCaptureState(
            false,
            devicePreferences.cameraDeviceId,
          ),
          deviceDiscoveryStatus: "idle",
          localPublications: {},
          microphone: createInitialCaptureState(
            false,
            devicePreferences.microphoneDeviceId,
          ),
          broadcastPublications: {},
          callAudioStatus: "idle",
          cameraPublishFailed: false,
          remoteAudioGains: {},
          remotePublications: {},
          remoteScreenShares: NOBODY_SHARING,
        });
      },
      toggleScreenShare() {
        if (disconnectTransport) screenShare.toggle();
      },
      async toggleSource(source) {
        const sourceState = get()[source];
        const nextEnabled = !sourceState.desiredEnabled;

        if (sourceState.status === "requesting" && !sourceState.track) {
          if (!nextEnabled) {
            operationVersions[source] += 1;
            updateSource(source, {
              desiredEnabled: false,
              status: "disabled",
            });
            return null;
          }

          updateSource(source, { desiredEnabled: nextEnabled });
          return null;
        }

        if (!sourceState.track) {
          updateSource(source, { desiredEnabled: true });
          await acquireSource(source, {
            deviceId: sourceState.selectedDeviceId,
            match: "ideal",
          });
          return get()[source].error;
        }

        if (!nextEnabled) {
          operationVersions[source] += 1;
          removeTrack(source, sourceState.track);
          removeLocalPublication(source);
          updateSource(source, {
            desiredEnabled: false,
            error: null,
            status: "disabled",
            track: null,
          });
          return null;
        }

        return null;
      },
    };
  });

  return store;
}
