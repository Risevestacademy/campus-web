export type MediaDeviceOption = Readonly<{
  id: string;
  isDefault: boolean;
  label: string;
}>;

export type AudioDeviceOption = MediaDeviceOption;

export type AudioDeviceList = Readonly<{
  microphones: AudioDeviceOption[];
  speakers: AudioDeviceOption[];
}>;

function getDeviceLabel(
  device: MediaDeviceInfo,
  fallbackLabel: string,
  index: number,
): string {
  const label = device.label.trim();
  const normalizedLabel =
    device.deviceId === "default"
      ? label.replace(/^default\s*[-–—]\s*/i, "")
      : label;

  return normalizedLabel || `${fallbackLabel} ${index + 1}`;
}

function mapDevices(
  devices: readonly MediaDeviceInfo[],
  kind: MediaDeviceKind,
  fallbackLabel: string,
): MediaDeviceOption[] {
  const matchingDevices = devices.filter((device) => device.kind === kind);

  return matchingDevices.map((device, index) => ({
    id: device.deviceId || `${kind}-${index + 1}`,
    isDefault: device.deviceId === "default",
    label: getDeviceLabel(device, fallbackLabel, index),
  }));
}

async function enumerateDevicesWithLabels(
  mediaDevices: MediaDevices,
  labelKinds: readonly MediaDeviceKind[],
  constraints: MediaStreamConstraints,
): Promise<MediaDeviceInfo[]> {
  const devices = await mediaDevices.enumerateDevices();
  const hasHiddenLabel = devices.some(
    (device) => labelKinds.includes(device.kind) && !device.label.trim(),
  );

  if (!hasHiddenLabel) return devices;

  const stream = await mediaDevices.getUserMedia(constraints);

  try {
    return await mediaDevices.enumerateDevices();
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}

function requireMediaDevices(
  mediaDevices: MediaDevices | undefined,
): MediaDevices {
  if (!mediaDevices) {
    throw new Error("Media device discovery is not supported.");
  }

  return mediaDevices;
}

export async function discoverAudioDevices(
  mediaDevices: MediaDevices | undefined = globalThis.navigator?.mediaDevices,
): Promise<AudioDeviceList> {
  const availableMediaDevices = requireMediaDevices(mediaDevices);
  const devices = await enumerateDevicesWithLabels(
    availableMediaDevices,
    ["audioinput", "audiooutput"],
    { audio: true },
  );

  return {
    microphones: mapDevices(devices, "audioinput", "Microphone"),
    speakers: mapDevices(devices, "audiooutput", "Speaker"),
  };
}

export async function discoverCameraDevices(
  mediaDevices: MediaDevices | undefined = globalThis.navigator?.mediaDevices,
): Promise<MediaDeviceOption[]> {
  const availableMediaDevices = requireMediaDevices(mediaDevices);
  const devices = await enumerateDevicesWithLabels(
    availableMediaDevices,
    ["videoinput"],
    { video: true },
  );

  return mapDevices(devices, "videoinput", "Camera");
}
