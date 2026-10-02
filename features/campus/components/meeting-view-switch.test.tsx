import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CampusMediaSessionProvider,
  MediaSessionProvider,
} from "../services/media-session/media-session-provider";
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
    window.localStorage.setItem(
      "campus-media-control-preferences",
      JSON.stringify({
        cameraEnabled: true,
        microphoneEnabled: false,
      }),
    );
    installTestMediaDevices([
      createTestMediaDevice("camera-1", "videoinput", "Camera"),
      createTestMediaDevice("microphone-1", "audioinput", "Microphone"),
    ]);
    render(
      <CampusMediaSessionProvider>
        <MeetingViewControls
          localParticipantId="participant-a"
          participants={meetingParticipants}
        />
      </CampusMediaSessionProvider>,
    );

    const localVideo = await screen.findByLabelText("Ada Lovelace video");

    expect(localVideo).toHaveProperty("srcObject", expect.any(Object));
    expect(screen.getByText("Waiting for video")).toBeInTheDocument();
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

  it("expands the meeting view and synchronizes the switch when a tile is activated", () => {
    renderMeetingViewControls();

    const meetingTiles = screen.getByRole("region", {
      name: "Meeting participant tiles",
    });
    const viewSwitch = screen.getByRole("switch", { name: "Use grid view" });
    const participantTile = screen.getByRole("button", {
      name: "Show expanded meeting view for James Baldwin",
    });

    fireEvent.click(participantTile, { detail: 1 });

    expect(meetingTiles).toHaveAttribute("data-motion", "animated");
    expect(viewSwitch).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("meeting-view-backdrop")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Focus James Baldwin" }),
    ).toBeInTheDocument();
  });

  it("focuses, swaps, and restores expanded meeting tiles", () => {
    renderMeetingViewControls();

    const viewSwitch = screen.getByRole("switch", { name: "Use grid view" });

    fireEvent.click(viewSwitch, { detail: 1 });

    const participantA = screen.getByRole("button", {
      name: "Focus Ada Lovelace",
    });
    const participantJ = screen.getByRole("button", {
      name: "Focus James Baldwin",
    });

    fireEvent.click(participantA, { detail: 1 });

    expect(participantA).toHaveAttribute("aria-pressed", "true");
    expect(participantA).toHaveAccessibleName("Restore equal meeting view");
    expect(participantJ).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(participantJ, { detail: 1 });

    expect(participantA).toHaveAttribute("aria-pressed", "false");
    expect(participantA).toHaveAccessibleName("Focus Ada Lovelace");
    expect(participantJ).toHaveAttribute("aria-pressed", "true");
    expect(participantJ).toHaveAccessibleName("Restore equal meeting view");

    fireEvent.click(participantJ, { detail: 1 });

    expect(participantA).toHaveAttribute("aria-pressed", "false");
    expect(participantJ).toHaveAttribute("aria-pressed", "false");
    expect(participantJ).toHaveAccessibleName("Focus James Baldwin");
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
