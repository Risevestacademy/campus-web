import type {
  DeviceCatalogSnapshot,
  MediaDeviceCatalog,
  MediaDeviceOption,
} from "./contracts";

type DeviceCatalogDependencies = Readonly<{
  mediaDevices: Pick<MediaDevices, "enumerateDevices">;
  onSnapshot: (snapshot: DeviceCatalogSnapshot) => void;
}>;

export type DeviceCatalog = Readonly<{
  refresh: () => Promise<DeviceCatalogSnapshot>;
  reset: () => void;
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

// Until access is granted, browsers expose one placeholder per kind with an
// empty deviceId. It names no real device, so it is never offered as a choice.
function isPermissionPlaceholder(device: MediaDeviceInfo) {
  return device.deviceId === "";
}

function mapDevices(
  devices: readonly MediaDeviceInfo[],
  kind: MediaDeviceKind,
  fallbackLabel: string,
): readonly MediaDeviceOption[] {
  return devices
    .filter(
      (device) => device.kind === kind && !isPermissionPlaceholder(device),
    )
    .map((device, index) => ({
      id: device.deviceId,
      isDefault: device.deviceId === "default",
      label: getDeviceLabel(device, fallbackLabel, index),
    }));
}

function requiresPermission(
  devices: readonly MediaDeviceInfo[],
  kind: MediaDeviceKind,
) {
  return devices.some(
    (device) => device.kind === kind && isPermissionPlaceholder(device),
  );
}

export async function discoverMediaDevices(
  mediaDevices: Pick<MediaDevices, "enumerateDevices">,
): Promise<MediaDeviceCatalog> {
  const devices = await mediaDevices.enumerateDevices();

  return {
    cameras: mapDevices(devices, "videoinput", "Camera"),
    microphones: mapDevices(devices, "audioinput", "Microphone"),
    permissionRequired: {
      cameras: requiresPermission(devices, "videoinput"),
      microphones: requiresPermission(devices, "audioinput"),
      speakers: requiresPermission(devices, "audiooutput"),
    },
    speakers: mapDevices(devices, "audiooutput", "Speaker"),
  };
}

export function createDeviceCatalog({
  mediaDevices,
  onSnapshot,
}: DeviceCatalogDependencies): DeviceCatalog {
  const idleSnapshot = {
    catalog: null,
    error: null,
    status: "idle",
  } satisfies DeviceCatalogSnapshot;
  let activeRefresh: Promise<DeviceCatalogSnapshot> | null = null;
  let generation = 0;
  let lastGoodCatalog: MediaDeviceCatalog | null = null;
  let trailingRefreshRequested = false;

  async function drainRefreshes(
    initialGeneration: number,
  ): Promise<DeviceCatalogSnapshot> {
    let refreshGeneration = initialGeneration;

    while (true) {
      trailingRefreshRequested = false;
      let catalog: MediaDeviceCatalog;

      try {
        catalog = await discoverMediaDevices(mediaDevices);
        if (refreshGeneration !== generation) {
          if (!trailingRefreshRequested) return idleSnapshot;
          refreshGeneration = generation;
          continue;
        }

        lastGoodCatalog = catalog;
      } catch {
        if (refreshGeneration !== generation) {
          if (!trailingRefreshRequested) return idleSnapshot;
          refreshGeneration = generation;
          continue;
        }
        if (trailingRefreshRequested) continue;

        if (!lastGoodCatalog) {
          const snapshot = {
            catalog: null,
            error: "enumeration-failed",
            status: "failed",
          } satisfies DeviceCatalogSnapshot;

          onSnapshot(snapshot);
          return snapshot;
        }

        const snapshot = {
          catalog: lastGoodCatalog,
          error: "enumeration-failed",
          status: "stale",
        } satisfies DeviceCatalogSnapshot;

        onSnapshot(snapshot);
        return snapshot;
      }

      if (trailingRefreshRequested) continue;

      const snapshot = {
        catalog,
        error: null,
        status: "ready",
      } satisfies DeviceCatalogSnapshot;

      onSnapshot(snapshot);
      return snapshot;
    }
  }

  function refresh() {
    if (activeRefresh) {
      trailingRefreshRequested = true;
      return activeRefresh;
    }

    onSnapshot({
      catalog: lastGoodCatalog,
      error: null,
      status: "refreshing",
    });

    const refreshPromise = drainRefreshes(generation).finally(() => {
      if (activeRefresh === refreshPromise) activeRefresh = null;
    });
    activeRefresh = refreshPromise;
    return refreshPromise;
  }

  function reset() {
    generation += 1;
    lastGoodCatalog = null;
    trailingRefreshRequested = false;
    onSnapshot(idleSnapshot);
  }

  return { refresh, reset };
}
