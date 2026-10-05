import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../services/media-session/media-session-store";
import {
  createTestMediaDevice,
  installTestMediaDevices,
} from "../testing/media-session-test-utils";
import { MeetingViewControls } from "./meeting-view-switch";

const meetingParticipants = [
  { id: "participant-a", initials: "A", name: "Ada Lovelace" },
  { id: "participant-j", initials: "J", name: "James Baldwin" },
] as const;

function renderMeetingViewControls() {
  const store = createMediaSessionStore({ mediaDevices: null });

  return render(
    <MediaSessionProvider store={store}>
      <MeetingViewControls
        localParticipantId="participant-a"
        participants={meetingParticipants}
      />
    </MediaSessionProvider>,
  );
}

describe("MeetingViewControls", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("renders the local camera publication in the matching participant tile", async () => {
    const mediaDevices = installTestMediaDevices([
      createTestMediaDevice("camera-1", "videoinput", "Camera"),
      createTestMediaDevice("microphone-1", "audioinput", "Microphone"),
    ]);
    const store = createMediaSessionStore({ mediaDevices });
    await store.getState().start();
    await store.getState().toggleSource("camera");
    render(
      <MediaSessionProvider store={store}>
        <MeetingViewControls
          localParticipantId="participant-a"
          participants={meetingParticipants}
        />
      </MediaSessionProvider>,
    );

    const localVideo = await screen.findByLabelText("Ada Lovelace video");

    expect(localVideo).toHaveProperty("srcObject", expect.any(Object));
    expect(screen.getByText("Waiting for video")).toBeInTheDocument();
    store.getState().stop();
  });

  it("animates pointer-driven tile expansion and makes keyboard changes instant", () => {
    renderMeetingViewControls();

    const viewSwitch = screen.getByRole("switch", { name: "Use grid view" });
    const meetingTiles = screen.getByRole("region", {
      name: "Meeting participant tiles",
    });

    expect(viewSwitch).toHaveAttribute("aria-checked", "false");

    fireEvent.click(viewSwitch, { detail: 1 });

    expect(viewSwitch).toHaveAttribute("aria-checked", "true");
    expect(meetingTiles).toHaveAttribute("data-motion", "animated");
    expect(screen.getByTestId("meeting-view-backdrop")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Focus Ada Lovelace" }),
    ).toBeInTheDocument();

    fireEvent.click(viewSwitch, { detail: 0 });

    expect(viewSwitch).toHaveAttribute("aria-checked", "false");
    expect(meetingTiles).toHaveAttribute("data-motion", "instant");
  });

  it("makes keyboard focus changes instant and clears focus on map view", () => {
    renderMeetingViewControls();

    const meetingTiles = screen.getByRole("region", {
      name: "Meeting participant tiles",
    });
    const viewSwitch = screen.getByRole("switch", { name: "Use grid view" });

    fireEvent.click(viewSwitch, { detail: 0 });
    fireEvent.click(
      screen.getByRole("button", { name: "Focus Ada Lovelace" }),
      { detail: 0 },
    );

    expect(meetingTiles).toHaveAttribute("data-motion", "instant");
    expect(
      screen.getByRole("button", { name: "Restore equal meeting view" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(viewSwitch, { detail: 0 });
    fireEvent.click(viewSwitch, { detail: 0 });

    expect(
      screen.getByRole("button", { name: "Focus Ada Lovelace" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "Focus James Baldwin" }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
