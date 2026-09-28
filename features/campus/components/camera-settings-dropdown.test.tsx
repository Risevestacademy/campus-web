import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CameraSettingsDropdown } from "./camera-settings-dropdown";

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

describe("CameraSettingsDropdown", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders only browser-provided camera devices", async () => {
    vi.stubGlobal("navigator", {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([
          createDevice({
            deviceId: "default",
            kind: "videoinput",
            label: "Default - FaceTime HD Camera",
          }),
          createDevice({
            deviceId: "studio-camera",
            kind: "videoinput",
            label: "Studio Camera",
          }),
          createDevice({
            deviceId: "microphone",
            kind: "audioinput",
            label: "Built-in Microphone",
          }),
        ]),
        getUserMedia: vi.fn(),
      },
    });
    render(<CameraSettingsDropdown />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open camera settings" }),
    );

    expect(
      await screen.findByRole("menuitemradio", {
        name: "FaceTime HD Camera, system default",
      }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("menuitemradio", { name: "Studio Camera" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitemradio", { name: "Built-in Microphone" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("menuitemradio", { name: "Studio Camera" }),
    );

    expect(
      await screen.findByRole("menuitemradio", { name: "Studio Camera" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("menuitemradio", {
        name: "FaceTime HD Camera, system default",
      }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("announces when camera discovery is unavailable", async () => {
    vi.stubGlobal("navigator", {
      mediaDevices: {
        enumerateDevices: vi.fn().mockRejectedValue(new Error("denied")),
        getUserMedia: vi.fn(),
      },
    });
    render(<CameraSettingsDropdown />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open camera settings" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Cameras unavailable",
      );
    });
  });
});
