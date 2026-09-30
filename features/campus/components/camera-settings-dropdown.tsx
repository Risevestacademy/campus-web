"use client";

import { discoverCameraDevices } from "../services/media-device-discovery";
import {
  type MediaDeviceGroup,
  MediaSettingsDropdown,
} from "./media-settings-dropdown";

async function discoverCameraDeviceGroups(): Promise<
  readonly MediaDeviceGroup[]
> {
  const devices = await discoverCameraDevices();

  return [
    {
      devices,
      emptyMessage: "No cameras found",
      id: "cameras",
      label: "Camera",
    },
  ];
}

export function CameraSettingsDropdown() {
  return (
    <MediaSettingsDropdown
      discoverGroups={discoverCameraDeviceGroups}
      label="Camera settings"
      statusMessages={{
        error: "Cameras unavailable",
        loading: "Loading cameras…",
      }}
      triggerLabel="Open camera settings"
    />
  );
}
