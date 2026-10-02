"use client";

import { useMediaSession } from "../services/media-session/media-session-provider";
import { MediaSettingsDropdown } from "./media-settings-dropdown";

export function CameraSettingsDropdown() {
  const camera = useMediaSession((state) => state.camera);
  const deviceDiscoveryStatus = useMediaSession(
    (state) => state.deviceDiscoveryStatus,
  );
  const refreshDevices = useMediaSession((state) => state.refreshDevices);
  const selectInputDevice = useMediaSession((state) => state.selectInputDevice);

  return (
    <MediaSettingsDropdown
      deviceDiscoveryStatus={deviceDiscoveryStatus}
      groups={[
        {
          devices: camera.devices,
          emptyMessage: "No cameras found",
          id: "cameras",
          label: "Camera",
        },
      ]}
      label="Camera settings"
      onRefresh={refreshDevices}
      onSelectionChange={(_groupId, deviceId) =>
        void selectInputDevice("camera", deviceId)
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
