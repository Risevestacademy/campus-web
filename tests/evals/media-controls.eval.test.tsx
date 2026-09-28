import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VisualsDisplay } from "@/features/campus";

function createDevice(
  deviceId: string,
  kind: MediaDeviceKind,
  label: string,
): MediaDeviceInfo {
  const device = { deviceId, groupId: `${deviceId}-group`, kind, label };

  return {
    ...device,
    toJSON: () => device,
  } as MediaDeviceInfo;
}

describe("media controls acceptance (required threshold: 2/2)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps media state independent and exposes both settings menus", () => {
    render(<VisualsDisplay />);

    const camera = screen.getByRole("button", { name: "Camera" });
    const microphone = screen.getByRole("button", { name: "Microphone" });

    expect(camera).toHaveAttribute("aria-pressed", "true");
    expect(microphone).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Open camera settings" }),
    ).toHaveAttribute("aria-haspopup", "menu");
    expect(
      screen.getByRole("button", { name: "Open audio settings" }),
    ).toHaveAttribute("aria-haspopup", "menu");

    fireEvent.click(camera);

    expect(camera).toHaveAttribute("aria-pressed", "false");
    expect(microphone).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(microphone);

    expect(camera).toHaveAttribute("aria-pressed", "false");
    expect(microphone).toHaveAttribute("aria-pressed", "false");
  });

  it("shows only browser-provided devices in the matching settings menu", async () => {
    const getUserMedia = vi.fn();
    vi.stubGlobal("navigator", {
      mediaDevices: {
        enumerateDevices: vi
          .fn()
          .mockResolvedValue([
            createDevice("default", "videoinput", "FaceTime HD Camera"),
            createDevice("mic-1", "audioinput", "Studio Microphone"),
            createDevice("speaker-1", "audiooutput", "Studio Speakers"),
          ]),
        getUserMedia,
      },
    });
    render(<VisualsDisplay />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open camera settings" }),
    );

    expect(
      await screen.findByRole("menuitemradio", {
        name: "FaceTime HD Camera, system default",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitemradio", { name: "Studio Microphone" }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Open audio settings" }),
    );

    expect(
      await screen.findByRole("menuitemradio", { name: "Studio Microphone" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "Studio Speakers" }),
    ).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
