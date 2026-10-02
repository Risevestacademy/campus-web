import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VisualsDisplay } from "@/features/campus";
import { CampusMediaSessionProvider } from "@/features/campus/services/media-session/media-session-provider";
import {
  createTestMediaDevice,
  installTestMediaDevices,
} from "@/features/campus/testing/media-session-test-utils";

function renderVisualsDisplay() {
  return render(
    <CampusMediaSessionProvider>
      <VisualsDisplay />
    </CampusMediaSessionProvider>,
  );
}

const availableDevices = [
  createTestMediaDevice("default", "videoinput", "FaceTime HD Camera"),
  createTestMediaDevice("mic-1", "audioinput", "Studio Microphone"),
  createTestMediaDevice("speaker-1", "audiooutput", "Studio Speakers"),
];

describe("media controls acceptance", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("keeps media state independent and exposes both settings menus", async () => {
    installTestMediaDevices(availableDevices);
    renderVisualsDisplay();

    const cameraControls = screen.getByRole("group", {
      name: "Camera controls",
    });
    const microphoneControls = screen.getByRole("group", {
      name: "Microphone controls",
    });
    const camera = within(cameraControls).getByRole("button", {
      name: "Turn on camera",
    });
    const microphone = within(microphoneControls).getByRole("button", {
      name: "Turn on microphone",
    });

    expect(camera).toHaveAttribute("aria-pressed", "false");
    expect(microphone).toHaveAttribute("aria-pressed", "false");
    expect(
      within(cameraControls).getByRole("button", {
        name: "Open camera settings",
      }),
    ).toHaveAttribute("aria-haspopup", "menu");
    expect(
      within(microphoneControls).getByRole("button", {
        name: "Open audio settings",
      }),
    ).toHaveAttribute("aria-haspopup", "menu");

    fireEvent.click(camera);

    await waitFor(() => {
      expect(camera).toHaveAttribute("aria-pressed", "true");
    });
    expect(camera).toHaveAccessibleName("Turn off camera");
    expect(microphone).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(microphone);

    await waitFor(() => {
      expect(microphone).toHaveAttribute("aria-pressed", "true");
    });
    expect(microphone).toHaveAccessibleName("Turn off microphone");
    expect(camera).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(camera);

    expect(camera).toHaveAttribute("aria-pressed", "false");
    expect(camera).toHaveAccessibleName("Turn on camera");
    expect(microphone).toHaveAttribute("aria-pressed", "true");
  });

  it("requires a fresh enable action after the provider remounts", async () => {
    const mediaDevices = installTestMediaDevices(availableDevices);
    const firstRender = renderVisualsDisplay();
    const firstCamera = screen.getByRole("button", {
      name: "Turn on camera",
    });

    fireEvent.click(firstCamera);
    await waitFor(() => {
      expect(firstCamera).toHaveAttribute("aria-pressed", "true");
    });
    const acquiredStream = await vi.mocked(mediaDevices.getUserMedia).mock
      .results[0]!.value;
    const cameraTrack = acquiredStream.getVideoTracks()[0]!;
    firstRender.unmount();

    expect(cameraTrack.stop).toHaveBeenCalledOnce();

    renderVisualsDisplay();

    expect(
      screen.getByRole("button", { name: "Turn on camera" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "Turn on microphone" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(mediaDevices.getUserMedia).toHaveBeenCalledOnce();
  });

  it("shows only browser-provided devices in the matching settings menu", async () => {
    installTestMediaDevices(availableDevices);
    renderVisualsDisplay();

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
  });

  it("announces when camera discovery is unavailable", async () => {
    const mediaDevices = installTestMediaDevices([]);
    vi.mocked(mediaDevices.enumerateDevices).mockRejectedValue(
      new Error("denied"),
    );
    renderVisualsDisplay();

    fireEvent.click(
      screen.getByRole("button", { name: "Open camera settings" }),
    );

    await waitFor(() => {
      const cameraSettings = screen.getByRole("menu", {
        name: "Open camera settings",
      });

      expect(within(cameraSettings).getByRole("status")).toHaveTextContent(
        "Cameras unavailable",
      );
    });
  });
});
