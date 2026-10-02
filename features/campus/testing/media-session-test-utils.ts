import { vi } from "vitest";

export type TestMediaTrack = MediaStreamTrack &
  Readonly<{ stop: ReturnType<typeof vi.fn> }>;

export function createTestMediaDevice(
  deviceId: string,
  kind: MediaDeviceKind,
  label: string,
): MediaDeviceInfo {
  const device = { deviceId, groupId: `${deviceId}-group`, kind, label };
  return { ...device, toJSON: () => device } as MediaDeviceInfo;
}

export function createTestMediaTrack(
  kind: "audio" | "video",
  deviceId: string,
): TestMediaTrack {
  return Object.assign(new EventTarget(), {
    enabled: true,
    getSettings: () => ({ deviceId }),
    kind,
    readyState: "live",
    stop: vi.fn(),
  }) as unknown as TestMediaTrack;
}

export function createTestMediaStream(
  tracks: readonly MediaStreamTrack[],
): MediaStream {
  return {
    getAudioTracks: () => tracks.filter((track) => track.kind === "audio"),
    getTracks: () => [...tracks],
    getVideoTracks: () => tracks.filter((track) => track.kind === "video"),
  } as unknown as MediaStream;
}

export function installTestMediaDevices(devices: readonly MediaDeviceInfo[]) {
  const mediaDevices = Object.assign(new EventTarget(), {
    enumerateDevices: vi.fn().mockResolvedValue(devices),
    getUserMedia: vi.fn(async (constraints: MediaStreamConstraints) => {
      const sourceKind = constraints.video ? "videoinput" : "audioinput";
      const trackKind = constraints.video ? "video" : "audio";
      const constraintsForKind = (constraints.video ||
        constraints.audio) as MediaTrackConstraints;
      const requestedDeviceId = constraintsForKind.deviceId as
        ConstrainDOMString | undefined;
      const exactDeviceId =
        typeof requestedDeviceId === "object" &&
        requestedDeviceId !== null &&
        "exact" in requestedDeviceId
          ? String(requestedDeviceId.exact)
          : undefined;
      const device = devices.find(
        (candidate) =>
          candidate.kind === sourceKind &&
          (!exactDeviceId || candidate.deviceId === exactDeviceId),
      );

      if (!device) throw new DOMException("missing", "NotFoundError");

      return createTestMediaStream([
        createTestMediaTrack(trackKind, device.deviceId),
      ]);
    }),
  }) as unknown as MediaDevices;

  vi.stubGlobal("navigator", { mediaDevices });
  return mediaDevices;
}
