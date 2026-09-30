import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AudioSettingsDropdown } from "./audio-settings-dropdown";

function createDevice({
  deviceId,
  kind,
  label,
}: Pick<MediaDeviceInfo, "deviceId" | "kind" | "label">): MediaDeviceInfo {
  const device = {
    deviceId,
    groupId: `${deviceId}-group`,
    kind,
    label,
  };

  return {
    ...device,
    toJSON: () => device,
  } as MediaDeviceInfo;
}

function useAvailableDevices() {
  const devices = [
    createDevice({
      deviceId: "default",
      kind: "audioinput",
      label: "Default - MacBook Pro Microphone",
    }),
    createDevice({
      deviceId: "usb-microphone",
      kind: "audioinput",
      label: "USB Studio Microphone",
    }),
    createDevice({
      deviceId: "default",
      kind: "audiooutput",
      label: "Default - MacBook Pro Speakers",
    }),
  ];

  vi.stubGlobal("navigator", {
    mediaDevices: {
      enumerateDevices: vi.fn().mockResolvedValue(devices),
      getUserMedia: vi.fn(),
    },
  });
}

describe("AudioSettingsDropdown", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders browser-provided microphone and speaker devices", async () => {
    useAvailableDevices();
    render(<AudioSettingsDropdown />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open audio settings" }),
    );

    expect(
      await screen.findByRole("menuitemradio", {
        name: "MacBook Pro Microphone, system default",
      }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("menuitemradio", {
        name: "USB Studio Microphone",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", {
        name: "MacBook Pro Speakers, system default",
      }),
    ).toHaveAttribute("aria-checked", "true");

    fireEvent.click(
      screen.getByRole("menuitemradio", {
        name: "USB Studio Microphone",
      }),
    );

    expect(
      await screen.findByRole("menuitemradio", {
        name: "USB Studio Microphone",
      }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("menuitemradio", {
        name: "MacBook Pro Speakers, system default",
      }),
    ).toHaveAttribute("aria-checked", "true");
  });
});
