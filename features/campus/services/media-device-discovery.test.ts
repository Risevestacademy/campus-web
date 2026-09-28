import { describe, expect, it, vi } from "vitest";

import {
  discoverAudioDevices,
  discoverCameraDevices,
} from "./media-device-discovery";

function createDevice(
  overrides: Partial<MediaDeviceInfo> & Pick<MediaDeviceInfo, "kind">,
): MediaDeviceInfo {
  const device = {
    deviceId: "device-id",
    groupId: "group-id",
    label: "",
    ...overrides,
  };

  return {
    ...device,
    toJSON: () => device,
  } as MediaDeviceInfo;
}

function createStream(stop: ReturnType<typeof vi.fn>): MediaStream {
  return {
    getTracks: () => [{ stop }],
  } as unknown as MediaStream;
}

const labeledDeviceCases: Array<{
  device: MediaDeviceInfo;
  discover: (mediaDevices: MediaDevices) => Promise<unknown>;
  name: string;
}> = [
  {
    discover: discoverAudioDevices,
    device: createDevice({
      deviceId: "microphone-1",
      kind: "audioinput",
      label: "Studio Microphone",
    }),
    name: "audio",
  },
  {
    discover: discoverCameraDevices,
    device: createDevice({
      deviceId: "camera-1",
      kind: "videoinput",
      label: "Studio Camera",
    }),
    name: "camera",
  },
];

describe("media device discovery", () => {
  it("requests audio permission for hidden labels and releases the temporary stream", async () => {
    const stop = vi.fn();
    const enumerateDevices = vi
      .fn()
      .mockResolvedValueOnce([
        createDevice({ deviceId: "default", kind: "audioinput" }),
      ])
      .mockResolvedValueOnce([
        createDevice({
          deviceId: "default",
          kind: "audioinput",
          label: "Default - MacBook Pro Microphone",
        }),
        createDevice({
          deviceId: "speaker-1",
          kind: "audiooutput",
          label: "MacBook Pro Speakers",
        }),
        createDevice({
          deviceId: "camera-1",
          kind: "videoinput",
          label: "FaceTime Camera",
        }),
      ]);
    const getUserMedia = vi.fn().mockResolvedValue(createStream(stop));
    const mediaDevices = {
      enumerateDevices,
      getUserMedia,
    } as unknown as MediaDevices;

    await expect(discoverAudioDevices(mediaDevices)).resolves.toEqual({
      microphones: [
        {
          id: "default",
          isDefault: true,
          label: "MacBook Pro Microphone",
        },
      ],
      speakers: [
        {
          id: "speaker-1",
          isDefault: false,
          label: "MacBook Pro Speakers",
        },
      ],
    });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(stop).toHaveBeenCalledOnce();
  });

  it("requests audio permission when only output labels are hidden", async () => {
    const stop = vi.fn();
    const enumerateDevices = vi
      .fn()
      .mockResolvedValueOnce([
        createDevice({
          deviceId: "microphone-1",
          kind: "audioinput",
          label: "Studio Microphone",
        }),
        createDevice({ deviceId: "speaker-1", kind: "audiooutput" }),
      ])
      .mockResolvedValueOnce([
        createDevice({
          deviceId: "microphone-1",
          kind: "audioinput",
          label: "Studio Microphone",
        }),
        createDevice({
          deviceId: "speaker-1",
          kind: "audiooutput",
          label: "Studio Speakers",
        }),
      ]);
    const getUserMedia = vi.fn().mockResolvedValue(createStream(stop));
    const mediaDevices = {
      enumerateDevices,
      getUserMedia,
    } as unknown as MediaDevices;

    await expect(discoverAudioDevices(mediaDevices)).resolves.toMatchObject({
      speakers: [{ label: "Studio Speakers" }],
    });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(stop).toHaveBeenCalledOnce();
  });

  it("requests camera permission for hidden labels and filters non-camera devices", async () => {
    const stop = vi.fn();
    const enumerateDevices = vi
      .fn()
      .mockResolvedValueOnce([
        createDevice({ deviceId: "default", kind: "videoinput" }),
      ])
      .mockResolvedValueOnce([
        createDevice({
          deviceId: "default",
          kind: "videoinput",
          label: "Default - FaceTime HD Camera",
        }),
        createDevice({
          deviceId: "microphone-1",
          kind: "audioinput",
          label: "Built-in Microphone",
        }),
      ]);
    const getUserMedia = vi.fn().mockResolvedValue(createStream(stop));
    const mediaDevices = {
      enumerateDevices,
      getUserMedia,
    } as unknown as MediaDevices;

    await expect(discoverCameraDevices(mediaDevices)).resolves.toEqual([
      {
        id: "default",
        isDefault: true,
        label: "FaceTime HD Camera",
      },
    ]);
    expect(getUserMedia).toHaveBeenCalledWith({ video: true });
    expect(stop).toHaveBeenCalledOnce();
  });

  it.each(labeledDeviceCases)(
    "does not request $name permission when labels are available",
    async ({ device, discover }) => {
      const getUserMedia = vi.fn();
      const mediaDevices = {
        enumerateDevices: vi.fn().mockResolvedValue([device]),
        getUserMedia,
      } as unknown as MediaDevices;

      await discover(mediaDevices);

      expect(getUserMedia).not.toHaveBeenCalled();
    },
  );
});
