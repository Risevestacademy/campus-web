"use client";

import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";

import { useMediaSession } from "../services/media-session/media-session-provider";
import {
  describeBlockedAccess,
  reportSpeakerResult,
  reportSwitchResult,
} from "./media-error-feedback";
import { MediaSettingsDropdown } from "./media-settings-dropdown";

export function AudioSettingsDropdown({
  onRetry,
}: Readonly<{ onRetry: () => Promise<void> }>) {
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
  const isAccessBlocked =
    microphone.error === "permission-denied" && !microphone.track;

  async function handleMicrophoneSelection(deviceId: string) {
    const hadActiveTrack = Boolean(microphone.track);
    const error = await selectInputDevice("microphone", deviceId);
    reportSwitchResult("microphone", error, hadActiveTrack);
  }

  async function handleChooseSpeaker() {
    reportSpeakerResult(await chooseAudioOutput());
  }

  return (
    <MediaSettingsDropdown
      action={
        output.supportsSelection ? (
          <DropdownMenuItem onClick={() => void handleChooseSpeaker()}>
            Choose speaker…
          </DropdownMenuItem>
        ) : null
      }
      deviceDiscoveryStatus={deviceDiscoveryStatus}
      groups={[
        {
          devices: microphone.devices,
          emptyMessage: microphone.devicesRequirePermission
            ? "Turn on your microphone to choose one"
            : "No microphones found",
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
      isDisabled={microphone.error === "unsupported"}
      label="Audio settings"
      onRefresh={refreshDevices}
      onSelectionChange={(groupId, deviceId) => {
        if (groupId === "microphones") {
          void handleMicrophoneSelection(deviceId);
          return;
        }

        selectOutputDevice(deviceId);
      }}
      recovery={
        isAccessBlocked
          ? {
              ...describeBlockedAccess("microphone"),
              onRetry: () => void onRetry(),
            }
          : undefined
      }
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
