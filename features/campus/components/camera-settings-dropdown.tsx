"use client";

import { useMediaSession } from "../services/media-session/media-session-provider";
import {
  describeBlockedAccess,
  reportSwitchResult,
} from "./media-error-feedback";
import { MediaSettingsDropdown } from "./media-settings-dropdown";

export function CameraSettingsDropdown({
  onRetry,
}: Readonly<{ onRetry: () => Promise<void> }>) {
  const camera = useMediaSession((state) => state.camera);
  const deviceDiscoveryStatus = useMediaSession(
    (state) => state.deviceDiscoveryStatus,
  );
  const refreshDevices = useMediaSession((state) => state.refreshDevices);
  const selectInputDevice = useMediaSession((state) => state.selectInputDevice);
  const isAccessBlocked = camera.error === "permission-denied" && !camera.track;

  async function handleCameraSelection(deviceId: string) {
    const hadActiveTrack = Boolean(camera.track);
    const error = await selectInputDevice("camera", deviceId);
    reportSwitchResult("camera", error, hadActiveTrack);
  }

  return (
    <MediaSettingsDropdown
      deviceDiscoveryStatus={deviceDiscoveryStatus}
      groups={[
        {
          devices: camera.devices,
          emptyMessage: camera.devicesRequirePermission
            ? "Turn on your camera to choose one"
            : "No cameras found",
          id: "cameras",
          label: "Camera",
        },
      ]}
      isDisabled={camera.error === "unsupported"}
      label="Camera settings"
      onRefresh={refreshDevices}
      onSelectionChange={(_groupId, deviceId) =>
        void handleCameraSelection(deviceId)
      }
      recovery={
        isAccessBlocked
          ? {
              ...describeBlockedAccess("camera"),
              onRetry: () => void onRetry(),
            }
          : undefined
      }
      selectedDeviceIds={{ cameras: camera.selectedDeviceId }}
      statusMessages={{
        error: "Cameras unavailable",
        loading: "Loading cameras…",
      }}
      triggerLabel="Open camera settings"
    />
  );
}
