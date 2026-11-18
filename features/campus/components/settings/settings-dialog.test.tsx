import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOTION_STORAGE_KEY } from "@/shared/motion";
import { THEME_STORAGE_KEY } from "@/shared/theme";

import { MediaSessionProvider } from "../../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../../services/media-session/media-session-store";
import {
  createTestMediaDevice,
  installTestMediaDevices,
  type TestMediaTrack,
} from "../../testing/media-session-test-utils";
import { CampusShell } from "../campus-shell/campus-shell";

const consent = vi.hoisted(() => ({
  grant: vi.fn(),
  deny: vi.fn(),
}));

vi.mock("@/core/analytics/client", () => ({
  denyAnalyticsConsent: consent.deny,
  grantAnalyticsConsent: consent.grant,
  readAnalyticsConsent: () => Promise.resolve("denied"),
  watchAnalyticsConsent: () => () => undefined,
}));

function OverviewPanelStub({ collapseButton }: { collapseButton: ReactNode }) {
  return <section aria-label="Overview panel">{collapseButton}</section>;
}

async function renderShell(logOut = vi.fn()) {
  installTestMediaDevices([
    createTestMediaDevice("camera-1", "videoinput", "FaceTime HD Camera"),
    createTestMediaDevice("camera-2", "videoinput", "USB Webcam"),
    createTestMediaDevice("mic-1", "audioinput", "Studio Microphone"),
  ]);
  const store = createMediaSessionStore({
    mediaDevices: navigator.mediaDevices,
  });
  await store.getState().start();

  const view = render(
    <MediaSessionProvider store={store}>
      <CampusShell
        LogOutAction={({ children }) => children({ logOut, isPending: false })}
        OverviewPanel={OverviewPanelStub}
        cohortId="c-1"
      >
        <p>Route content</p>
      </CampusShell>
    </MediaSessionProvider>,
  );

  return { store, logOut, view };
}

// The first track a test captured.
async function firstCapturedTrack(): Promise<TestMediaTrack> {
  const getUserMedia = vi.mocked(navigator.mediaDevices.getUserMedia);
  const streams = await Promise.all(
    getUserMedia.mock.results.map(({ value }) => value as Promise<MediaStream>),
  );
  const [track] = streams.flatMap(
    (stream) => stream.getTracks() as TestMediaTrack[],
  );
  if (!track) throw new Error("Nothing was captured");
  return track;
}

async function openSettings() {
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  return screen.findByRole("dialog", { name: "Settings" });
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.dataset.theme = "light";
  delete document.documentElement.dataset.motion;
});

beforeEach(() => {
  vi.stubGlobal(
    "MediaStream",
    class {
      constructor(readonly tracks: MediaStreamTrack[]) {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SettingsDialog", () => {
  it("opens from the rail on Audio & video and switches cameras", async () => {
    const { store } = await renderShell();
    const dialog = await openSettings();

    expect(
      within(dialog).getByRole("tab", { name: "Audio & video" }),
    ).toHaveAttribute("aria-selected", "true");
    const camera = within(dialog).getByRole("combobox", { name: "Camera" });
    await waitFor(() => expect(camera).toBeEnabled());
    fireEvent.change(camera, { target: { value: "camera-2" } });

    await waitFor(() => {
      expect(store.getState().camera.selectedDeviceId).toBe("camera-2");
    });
  });

  it("previews the chosen camera without publishing it, and stops on request", async () => {
    const { store } = await renderShell();
    const dialog = await openSettings();

    fireEvent.click(
      await within(dialog).findByRole("button", { name: "Preview camera" }),
    );

    expect(
      await within(dialog).findByLabelText("Camera preview"),
    ).toBeInstanceOf(HTMLVideoElement);
    expect(store.getState().localPublications.camera).toBeUndefined();
    const track = await firstCapturedTrack();
    expect(track.kind).toBe("video");

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Stop preview" }),
    );

    expect(track.stop).toHaveBeenCalledOnce();
    expect(
      within(dialog).getByRole("button", { name: "Preview camera" }),
    ).toBeInTheDocument();
  });

  it("tests the microphone locally and releases it when Settings closes", async () => {
    const { store } = await renderShell();
    const dialog = await openSettings();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Test microphone" }),
    );

    expect(
      await within(dialog).findByRole("button", {
        name: "Stop microphone test",
      }),
    ).toBeInTheDocument();
    expect(store.getState().microphone.track).toBeNull();
    const track = await firstCapturedTrack();
    expect(track.kind).toBe("audio");

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Close settings" }),
    );

    await waitFor(() => expect(track.stop).toHaveBeenCalledOnce());
  });

  it("plays a test sound through the chosen speaker", async () => {
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:test-tone"),
        revokeObjectURL: vi.fn(),
      }),
    );
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    await renderShell();
    const dialog = await openSettings();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Play test sound" }),
    );

    expect(play).toHaveBeenCalledOnce();
    expect(
      await within(dialog).findByRole("button", { name: "Play test sound" }),
    ).toHaveTextContent("Playing…");
    const [audio] = play.mock.contexts as HTMLAudioElement[];
    if (!audio) throw new Error("No sound was played");
    fireEvent(audio, new Event("ended"));
    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", { name: "Play test sound" }),
      ).toHaveTextContent("Test");
    });
  });

  it("shows joining muted and noise suppression without letting them change", async () => {
    await renderShell();
    const dialog = await openSettings();

    for (const name of [
      "Join with microphone off",
      "Join with camera off",
      "Noise suppression",
    ]) {
      expect(within(dialog).getByRole("switch", { name })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    }
    expect(
      within(dialog).getByRole("switch", { name: "Noise suppression" }),
    ).toBeChecked();
  });

  it("keeps a Notifications tab that holds nothing yet", async () => {
    await renderShell();
    const dialog = await openSettings();

    fireEvent.click(within(dialog).getByRole("tab", { name: "Notifications" }));

    const panel = within(dialog).getByRole("tabpanel");
    expect(panel).toHaveTextContent(/^Notifications$/);
  });

  it("matches the device's theme by forgetting the stored one", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    await renderShell();
    const dialog = await openSettings();
    fireEvent.click(within(dialog).getByRole("tab", { name: "Appearance" }));

    const themes = within(dialog).getByRole("radiogroup", { name: "Theme" });
    expect(within(themes).getByRole("radio", { name: "Light" })).toBeChecked();
    fireEvent.click(
      within(themes).getByRole("radio", { name: "Match device" }),
    );

    await waitFor(() => {
      expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    });
    expect(
      within(themes).getByRole("radio", { name: "Match device" }),
    ).toBeChecked();
  });

  it("reduces motion across Campus when asked", async () => {
    await renderShell();
    const dialog = await openSettings();
    fireEvent.click(within(dialog).getByRole("tab", { name: "Appearance" }));

    fireEvent.click(
      within(dialog).getByRole("switch", { name: "Reduce motion" }),
    );

    expect(document.documentElement).toHaveAttribute("data-motion", "reduce");
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBe("reduce");
    expect(
      within(dialog).getByRole("switch", { name: "Reduce motion" }),
    ).toBeChecked();
  });

  it("turns usage analytics on from Privacy", async () => {
    await renderShell();
    const dialog = await openSettings();
    fireEvent.click(within(dialog).getByRole("tab", { name: "Privacy" }));

    const analytics = within(dialog).getByRole("switch", {
      name: "Usage analytics",
    });
    await waitFor(() => expect(analytics).toBeEnabled());
    expect(analytics).not.toBeChecked();
    fireEvent.click(analytics);

    expect(consent.grant).toHaveBeenCalledOnce();
    expect(analytics).toBeChecked();
  });

  it("asks before logging out", async () => {
    const { logOut } = await renderShell();
    const dialog = await openSettings();

    fireEvent.click(within(dialog).getByRole("button", { name: "Log out" }));
    const prompt = await screen.findByRole("dialog", {
      name: "Log out of Campus?",
    });
    expect(logOut).not.toHaveBeenCalled();
    fireEvent.click(within(prompt).getByRole("button", { name: "Log out" }));

    expect(logOut).toHaveBeenCalledOnce();
  });
});
