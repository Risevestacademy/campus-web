"use client";

import { discoverAudioDevices } from "../services/media-device-discovery";
import {
  type MediaDeviceGroup,
  MediaSettingsDropdown,
} from "./media-settings-dropdown";

async function discoverAudioDeviceGroups(): Promise<
  readonly MediaDeviceGroup[]
> {
  const devices = await discoverAudioDevices();

  return [
    {
      devices: devices.microphones,
      emptyMessage: "No microphones found",
      id: "microphones",
      label: "Microphone",
    },
    {
      devices: devices.speakers,
      emptyMessage: "No speakers found",
      id: "speakers",
      label: "Speaker",
    },
  ];
}

export function AudioSettingsDropdown() {
  return (
    <MediaSettingsDropdown
      discoverGroups={discoverAudioDeviceGroups}
      label="Audio settings"
      statusMessages={{
        error: "Audio devices unavailable",
        loading: "Loading audio devices…",
      }}
      triggerLabel="Open audio settings"
    />
  );
}
