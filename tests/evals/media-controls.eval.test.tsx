import {
  act,
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
import { toast, Toaster } from "@/shared/ui/toast";

function renderVisualsDisplay() {
  return render(
    <>
      <CampusMediaSessionProvider>
        <VisualsDisplay />
      </CampusMediaSessionProvider>
      <Toaster />
    </>,
  );
}

const availableDevices = [
  createTestMediaDevice("default", "videoinput", "FaceTime HD Camera"),
  createTestMediaDevice("mic-1", "audioinput", "Studio Microphone"),
  createTestMediaDevice("speaker-1", "audiooutput", "Studio Speakers"),
];

describe("media controls acceptance", () => {
  afterEach(() => {
    toast.close();
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

  it("keeps settings recovery available when camera permission is denied", async () => {
    const mediaDevices = installTestMediaDevices(availableDevices);
    vi.mocked(mediaDevices.getUserMedia).mockRejectedValueOnce(
      new DOMException("denied", "NotAllowedError"),
    );
    renderVisualsDisplay();

    const cameraControls = screen.getByRole("group", {
      name: "Camera controls",
    });
    fireEvent.click(
      within(cameraControls).getByRole("button", { name: "Turn on camera" }),
    );

    await waitFor(() => {
      expect(
        within(cameraControls).getByRole("button", {
          name: "Camera access blocked",
        }),
      ).toBeDisabled();
    });

    const cameraSettings = within(cameraControls).getByRole("button", {
      name: "Open camera settings",
    });
    expect(cameraSettings).toBeEnabled();
    fireEvent.click(cameraSettings);
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Try camera again" }),
    );

    await waitFor(() => {
      expect(
        within(cameraControls).getByRole("button", {
          name: "Turn off camera",
        }),
      ).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("reports denied camera access without expanding the control layout", async () => {
    const mediaDevices = installTestMediaDevices(availableDevices);
    vi.mocked(mediaDevices.getUserMedia).mockRejectedValue(
      new DOMException("denied", "NotAllowedError"),
    );
    renderVisualsDisplay();

    fireEvent.click(screen.getByRole("button", { name: "Turn on camera" }));

    const notification = await screen.findByRole("alert");
    expect(
      within(notification).getByText("Camera is blocked"),
    ).toBeInTheDocument();
    expect(
      within(notification).getByText(
        "Allow camera access in your browser settings, then try again.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Camera unavailable. Use the camera control to retry.",
      ),
    ).not.toBeInTheDocument();
  });

  it("keeps device settings available when the selected camera is unavailable", async () => {
    installTestMediaDevices([]);
    renderVisualsDisplay();

    const cameraControls = screen.getByRole("group", {
      name: "Camera controls",
    });
    fireEvent.click(
      within(cameraControls).getByRole("button", { name: "Turn on camera" }),
    );

    await waitFor(() => {
      expect(
        within(cameraControls).getByRole("button", {
          name: "Camera unavailable",
        }),
      ).toBeDisabled();
    });
    expect(
      within(cameraControls).getByRole("button", {
        name: "Open camera settings",
      }),
    ).toBeEnabled();
  });

  it("keeps a temporarily unreadable camera available for retry", async () => {
    const mediaDevices = installTestMediaDevices(availableDevices);
    vi.mocked(mediaDevices.getUserMedia).mockRejectedValue(
      new DOMException("busy", "NotReadableError"),
    );
    renderVisualsDisplay();

    const cameraControls = screen.getByRole("group", {
      name: "Camera controls",
    });
    fireEvent.click(
      within(cameraControls).getByRole("button", { name: "Turn on camera" }),
    );

    await waitFor(() => {
      expect(
        within(cameraControls).getByRole("button", {
          name: "Try camera again",
        }),
      ).toBeEnabled();
    });
  });

  it("disables the camera group when capture is unsupported", async () => {
    vi.stubGlobal("navigator", {});
    renderVisualsDisplay();

    const cameraControls = screen.getByRole("group", {
      name: "Camera controls",
    });
    fireEvent.click(
      within(cameraControls).getByRole("button", { name: "Turn on camera" }),
    );

    await waitFor(() => {
      expect(
        within(cameraControls).getByRole("button", {
          name: "Camera unsupported",
        }),
      ).toBeDisabled();
    });
    expect(
      within(cameraControls).getByRole("button", {
        name: "Open camera settings",
      }),
    ).toBeDisabled();
  });

  it("blocks only the microphone when microphone permission is denied", async () => {
    const mediaDevices = installTestMediaDevices(availableDevices);
    vi.mocked(mediaDevices.getUserMedia).mockRejectedValueOnce(
      new DOMException("denied", "NotAllowedError"),
    );
    renderVisualsDisplay();

    const cameraControls = screen.getByRole("group", {
      name: "Camera controls",
    });
    const microphoneControls = screen.getByRole("group", {
      name: "Microphone controls",
    });
    fireEvent.click(
      within(microphoneControls).getByRole("button", {
        name: "Turn on microphone",
      }),
    );

    await waitFor(() => {
      expect(
        within(microphoneControls).getByRole("button", {
          name: "Microphone access blocked",
        }),
      ).toBeDisabled();
    });
    expect(
      microphoneControls.querySelector("[data-slot=microphone-blocked-badge]"),
    ).toHaveClass("opacity-100");
    expect(
      cameraControls.querySelector("[data-slot=video-blocked-badge]"),
    ).toHaveClass("opacity-0");

    const camera = within(cameraControls).getByRole("button", {
      name: "Turn on camera",
    });
    expect(camera).toBeEnabled();
    fireEvent.click(camera);
    await waitFor(() => {
      expect(camera).toHaveAttribute("aria-pressed", "true");
    });

    fireEvent.click(
      within(microphoneControls).getByRole("button", {
        name: "Open audio settings",
      }),
    );
    expect(
      await screen.findByRole("menuitem", { name: "Try microphone again" }),
    ).toHaveAccessibleDescription(
      "Allow microphone access in your browser settings, then try again.",
    );
  });

  it("keeps the previous camera on and reports a failed switch", async () => {
    const mediaDevices = installTestMediaDevices([
      ...availableDevices,
      createTestMediaDevice("desk-camera", "videoinput", "Desk Camera"),
    ]);
    renderVisualsDisplay();

    const cameraControls = screen.getByRole("group", {
      name: "Camera controls",
    });
    const camera = within(cameraControls).getByRole("button", {
      name: "Turn on camera",
    });
    fireEvent.click(camera);
    await waitFor(() => {
      expect(camera).toHaveAttribute("aria-pressed", "true");
    });

    vi.mocked(mediaDevices.getUserMedia).mockRejectedValueOnce(
      new DOMException("busy", "NotReadableError"),
    );
    fireEvent.click(
      within(cameraControls).getByRole("button", {
        name: "Open camera settings",
      }),
    );
    fireEvent.click(
      await screen.findByRole("menuitemradio", { name: "Desk Camera" }),
    );

    const notification = await screen.findByRole("alert");
    expect(notification).toHaveTextContent("Couldn't switch camera");
    expect(notification).toHaveTextContent("Your previous camera is still on.");
    expect(camera).toHaveAttribute("aria-pressed", "true");
  });

  it("reports a failed speaker choice but not a dismissed picker", async () => {
    const mediaDevices = installTestMediaDevices(availableDevices);
    const selectAudioOutput = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("dismissed", "NotAllowedError"))
      .mockRejectedValueOnce(new DOMException("missing", "NotFoundError"));
    Object.assign(mediaDevices, { selectAudioOutput });
    renderVisualsDisplay();

    async function chooseSpeaker() {
      fireEvent.click(
        screen.getByRole("button", { name: "Open audio settings" }),
      );
      fireEvent.click(
        await screen.findByRole("menuitem", { name: "Choose speaker…" }),
      );
      await waitFor(() => {
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      });
    }

    await chooseSpeaker();
    await waitFor(() => {
      expect(selectAudioOutput).toHaveBeenCalledOnce();
    });
    await act(async () => {});
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await chooseSpeaker();
    const notification = await screen.findByRole("alert");
    expect(notification).toHaveTextContent("Couldn't choose a speaker");
    expect(notification).toHaveTextContent(
      "Audio keeps playing through your current speaker.",
    );
  });

  it("re-enables an unavailable camera when a camera is connected", async () => {
    const mediaDevices = installTestMediaDevices(availableDevices);
    vi.mocked(mediaDevices.getUserMedia).mockRejectedValueOnce(
      new DOMException("missing", "NotFoundError"),
    );
    renderVisualsDisplay();

    const cameraControls = screen.getByRole("group", {
      name: "Camera controls",
    });
    fireEvent.click(
      within(cameraControls).getByRole("button", { name: "Turn on camera" }),
    );
    await waitFor(() => {
      expect(
        within(cameraControls).getByRole("button", {
          name: "Camera unavailable",
        }),
      ).toBeDisabled();
    });

    await act(async () => {
      mediaDevices.dispatchEvent(new Event("devicechange"));
    });

    const camera = await within(cameraControls).findByRole("button", {
      name: "Turn on camera",
    });
    expect(camera).toBeEnabled();
    fireEvent.click(camera);
    await waitFor(() => {
      expect(camera).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("disables the microphone group when capture is unsupported", async () => {
    vi.stubGlobal("navigator", {});
    renderVisualsDisplay();

    const microphoneControls = screen.getByRole("group", {
      name: "Microphone controls",
    });
    fireEvent.click(
      within(microphoneControls).getByRole("button", {
        name: "Turn on microphone",
      }),
    );

    await waitFor(() => {
      expect(
        within(microphoneControls).getByRole("button", {
          name: "Microphone unsupported",
        }),
      ).toBeDisabled();
    });
    expect(
      within(microphoneControls).getByRole("button", {
        name: "Open audio settings",
      }),
    ).toBeDisabled();
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
