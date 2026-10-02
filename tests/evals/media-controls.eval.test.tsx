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
      name: "Camera",
    });
    const microphone = within(microphoneControls).getByRole("button", {
      name: "Microphone",
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
    expect(microphone).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(microphone);

    await waitFor(() => {
      expect(microphone).toHaveAttribute("aria-pressed", "true");
    });
    expect(camera).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(camera);

    expect(camera).toHaveAttribute("aria-pressed", "false");
    expect(microphone).toHaveAttribute("aria-pressed", "true");
  });

  it("restores persisted media intent after the provider remounts", async () => {
    installTestMediaDevices(availableDevices);
    const firstRender = renderVisualsDisplay();
    const firstCamera = screen.getByRole("button", { name: "Camera" });

    fireEvent.click(firstCamera);
    await waitFor(() => {
      expect(firstCamera).toHaveAttribute("aria-pressed", "true");
    });
    firstRender.unmount();

    renderVisualsDisplay();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Camera" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    expect(screen.getByRole("button", { name: "Microphone" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
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
