import { createStore, type StoreApi } from "zustand/vanilla";

import type {
  AudioOutputState,
  CaptureSource,
  CaptureSourceState,
  DeviceDiscoveryStatus,
  LocalMediaPublication,
  MediaSessionErrorCode,
  MeetingMediaTransport,
  PublicationSource,
  RemotePublicationRegistry,
} from "./contracts";
import { discoverMediaDevices } from "./device-discovery";
import {
  DEFAULT_MEDIA_CONTROL_PREFERENCES,
  readMediaControlPreferences,
  writeMediaControlPreferences,
} from "./media-control-preferences";
import { noopMeetingMediaTransport } from "./meeting-media-transport";
import {
  removeRemotePublication,
  upsertRemotePublication,
} from "./publication-registry";

type SelectableAudioOutputMediaDevices = MediaDevices &
  Readonly<{
    selectAudioOutput?: () => Promise<MediaDeviceInfo>;
  }>;

export type MediaSessionState = Readonly<{
  camera: CaptureSourceState;
  chooseAudioOutput: () => Promise<void>;
  deviceDiscoveryStatus: DeviceDiscoveryStatus;
  localPublications: Readonly<
    Partial<Record<PublicationSource, LocalMediaPublication>>
  >;
  microphone: CaptureSourceState;
  output: AudioOutputState;
  refreshDevices: () => Promise<void>;
  remotePublications: RemotePublicationRegistry;
  selectInputDevice: (source: CaptureSource, deviceId: string) => Promise<void>;
  selectOutputDevice: (deviceId: string) => void;
  start: () => Promise<void>;
  stop: () => void;
  toggleSource: (source: CaptureSource) => Promise<void>;
}>;

type MediaSessionStoreDependencies = Readonly<{
  createMediaStream?: () => MediaStream;
  mediaDevices?: MediaDevices | null;
  transport?: MeetingMediaTransport;
}>;

function createInitialCaptureState(
  desiredEnabled: boolean,
): CaptureSourceState {
  return {
    desiredEnabled,
    devices: [],
    error: null,
    selectedDeviceId: "",
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

function getConstraints(
  source: CaptureSource,
  deviceId?: string,
): MediaStreamConstraints {
  const deviceConstraint = deviceId ? { exact: deviceId } : undefined;

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
  let preferences = DEFAULT_MEDIA_CONTROL_PREFERENCES;
  const localStream = createMediaStream();
  const operationVersions: Record<CaptureSource, number> = {
    camera: 0,
    microphone: 0,
  };
  const endedHandlers: Partial<Record<CaptureSource, (event: Event) => void>> =
    {};
  let started = false;
  let removeDeviceChangeListener: (() => void) | undefined;
  let unsubscribeRemotePublications: (() => void) | undefined;

  const store = createStore<MediaSessionState>((set, get) => {
    function persistSourcePreference(
      source: CaptureSource,
      desiredEnabled: boolean,
    ) {
      preferences =
        source === "camera"
          ? { ...preferences, cameraEnabled: desiredEnabled }
          : { ...preferences, microphoneEnabled: desiredEnabled };
      writeMediaControlPreferences(preferences);
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

      transport.handleLocalPublicationChange(
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
      transport.handleLocalPublicationChange({
        previousTrack: track,
        publicationId: `local-${source}`,
        source,
        type: "removed",
      });
    }

    async function refreshDevices() {
      if (!mediaDevices) {
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

      set({ deviceDiscoveryStatus: "loading" });

      try {
        const devices = await discoverMediaDevices(mediaDevices);

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
            camera: { ...state.camera, devices: devices.cameras },
            deviceDiscoveryStatus: "ready",
            microphone: {
              ...state.microphone,
              devices: devices.microphones,
            },
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
      } catch {
        set((state) => ({
          deviceDiscoveryStatus: "failed",
          output: { ...state.output, error: "unknown", status: "failed" },
        }));
      }
    }

    async function acquireSource(source: CaptureSource, deviceId?: string) {
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
          getConstraints(source, deviceId),
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
          transport.handleLocalPublicationChange({
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
          deviceId ??
          currentSource.selectedDeviceId;

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
      camera: createInitialCaptureState(false),
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
          return;
        }

        try {
          const device = await selectableMediaDevices.selectAudioOutput();
          await refreshDevices();
          set((state) => ({
            output: {
              ...state.output,
              error: null,
              selectedDeviceId: device.deviceId,
              status: "ready",
            },
          }));
        } catch (error) {
          set((state) => ({
            output: {
              ...state.output,
              error: getErrorCode(error),
              status: "failed",
            },
          }));
        }
      },
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
      remotePublications: {},
      async selectInputDevice(source, deviceId) {
        const sourceState = get()[source];
        if (!sourceState.desiredEnabled && !sourceState.track) {
          updateSource(source, {
            error: null,
            selectedDeviceId: deviceId,
            status: "disabled",
          });
          return;
        }

        await acquireSource(source, deviceId);
      },
      selectOutputDevice(deviceId) {
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
        preferences = readMediaControlPreferences();
        set({
          camera: createInitialCaptureState(preferences.cameraEnabled),
          microphone: createInitialCaptureState(preferences.microphoneEnabled),
        });

        unsubscribeRemotePublications = transport.subscribeToRemotePublications(
          (change) => {
            set((state) => ({
              remotePublications:
                change.type === "upserted"
                  ? upsertRemotePublication(
                      state.remotePublications,
                      change.publication,
                    )
                  : removeRemotePublication(state.remotePublications, change),
            }));
          },
        );

        if (mediaDevices) {
          const deviceChangeHandler = () => void handleDeviceChange();
          mediaDevices.addEventListener("devicechange", deviceChangeHandler);
          removeDeviceChangeListener = () =>
            mediaDevices.removeEventListener(
              "devicechange",
              deviceChangeHandler,
            );
        }

        const enabledSources = (["camera", "microphone"] as const).filter(
          (source) => get()[source].desiredEnabled,
        );
        await Promise.all(
          enabledSources.map((source) => acquireSource(source)),
        );
      },
      stop() {
        if (!started) return;
        started = false;
        operationVersions.camera += 1;
        operationVersions.microphone += 1;
        removeDeviceChangeListener?.();
        removeDeviceChangeListener = undefined;
        unsubscribeRemotePublications?.();
        unsubscribeRemotePublications = undefined;

        for (const source of ["camera", "microphone"] as const) {
          const track = get()[source].track;
          if (track) removeTrack(source, track);
        }

        set({
          camera: createInitialCaptureState(preferences.cameraEnabled),
          deviceDiscoveryStatus: "idle",
          localPublications: {},
          microphone: createInitialCaptureState(preferences.microphoneEnabled),
          remotePublications: {},
        });
      },
      async toggleSource(source) {
        const sourceState = get()[source];
        const nextEnabled = !sourceState.desiredEnabled;
        persistSourcePreference(source, nextEnabled);

        if (sourceState.status === "requesting" && !sourceState.track) {
          if (source === "camera" && !nextEnabled) {
            operationVersions.camera += 1;
            updateSource("camera", {
              desiredEnabled: false,
              status: "disabled",
            });
            return;
          }

          updateSource(source, { desiredEnabled: nextEnabled });
          return;
        }

        if (!sourceState.track) {
          updateSource(source, { desiredEnabled: true });
          await acquireSource(
            source,
            sourceState.selectedDeviceId || undefined,
          );
          return;
        }

        if (source === "camera" && !nextEnabled) {
          operationVersions.camera += 1;
          removeTrack(source, sourceState.track);
          removeLocalPublication(source);
          updateSource(source, {
            desiredEnabled: false,
            error: null,
            status: "disabled",
            track: null,
          });
          return;
        }

        sourceState.track.enabled = nextEnabled;
        updateSource(source, {
          desiredEnabled: nextEnabled,
          status: nextEnabled ? "ready" : "disabled",
        });
        set((state) => ({
          localPublications: {
            ...state.localPublications,
            [source]: {
              ...state.localPublications[source]!,
              enabled: nextEnabled,
            },
          },
        }));
        transport.handleLocalPublicationChange({
          enabled: nextEnabled,
          publicationId: `local-${source}`,
          source,
          type: "enabled-changed",
        });
      },
    };
  });

  return store;
}
