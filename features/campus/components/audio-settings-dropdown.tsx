"use client";

import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";

import { useMediaSession } from "../services/media-session/media-session-provider";
import { MediaSettingsDropdown } from "./media-settings-dropdown";

export function AudioSettingsDropdown() {
  const deviceDiscoveryStatus = useMediaSession(
    (state) => state.deviceDiscoveryStatus,
  );
  const microphone = useMediaSession((state) => state.microphone);
  const output = useMediaSession((state) => state.output);
  const chooseAudioOutput = useMediaSession((state) => state.chooseAudioOutput);
  const refreshDevices = useMediaSession((state) => state.refreshDevices);
  const selectInputDevice = useMediaSession((state) => state.selectInputDevice);
  const selectOutputDevice = useMediaSession(
    (state) => state.selectOutputDevice,
  );

  return (
    <MediaSettingsDropdown
      action={
        output.supportsSelection ? (
          <DropdownMenuItem onClick={() => void chooseAudioOutput()}>
            Choose speaker…
          </DropdownMenuItem>
        ) : null
      }
      deviceDiscoveryStatus={deviceDiscoveryStatus}
      groups={[
        {
          devices: microphone.devices,
          emptyMessage: "No microphones found",
          id: "microphones",
          label: "Microphone",
        },
        {
          devices: output.devices,
          emptyMessage: "System default speaker",
          id: "speakers",
          label: "Speaker",
        },
      ]}
      label="Audio settings"
      onRefresh={refreshDevices}
      onSelectionChange={(groupId, deviceId) => {
        if (groupId === "microphones") {
          void selectInputDevice("microphone", deviceId);
          return;
        }

        selectOutputDevice(deviceId);
      }}
      selectedDeviceIds={{
        microphones: microphone.selectedDeviceId,
        speakers: output.selectedDeviceId,
      }}
      statusMessages={{
        error: "Audio devices unavailable",
        loading: "Loading audio devices…",
      }}
      triggerLabel="Open audio settings"
    />
  );
}
