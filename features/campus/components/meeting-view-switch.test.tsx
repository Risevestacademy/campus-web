import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../services/media-session/media-session-store";
import {
  createTestMediaDevice,
  installTestMediaDevices,
} from "../testing/media-session-test-utils";
import type { Meeting, MeetingParticipant } from "../types/active-campus.types";
import { CampusViewProvider } from "./campus-view-provider";
import { MeetingViewControls } from "./meeting-view-switch";

const meeting: Meeting = {
  encounter: 1,
  hearing: "proximity",
  title: "Nearby",
  localParticipantId: "participant-a",
  participants: [
    {
      id: "participant-a",
      initials: "A",
      name: "Ada Lovelace",
      tone: "cobalt",
    },
    {
      id: "participant-j",
      initials: "J",
      name: "James Baldwin",
      tone: "lemon",
    },
  ],
};

function renderMeetingViewControls(
  shownMeeting: Meeting = meeting,
  store = createMediaSessionStore({ mediaDevices: null }),
) {
  return render(
    <MediaSessionProvider store={store}>
      <CampusViewProvider>
        <MeetingViewControls meeting={shownMeeting} />
      </CampusViewProvider>
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
    renderMeetingViewControls(meeting, store);

    const localVideo = await screen.findByLabelText("Ada Lovelace video");

    expect(localVideo).toHaveProperty("srcObject", expect.any(Object));
    expect(screen.getByText("James Baldwin")).toBeInTheDocument();
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

  it("shows four tiles on the map and opens the grid for everyone from the rest", () => {
    const names = ["Ada", "Grace", "Lin", "Maya", "Toni", "Zadie"];
    const crowd: Meeting = {
      ...meeting,
      localParticipantId: "Ada",
      participants: names.map((name): MeetingParticipant => ({
        id: name,
        initials: name[0] ?? "?",
        name,
        tone: "cobalt",
      })),
    };
    renderMeetingViewControls(crowd);

    expect(
      screen.getAllByRole("button", { name: /^Show expanded meeting view/ }),
    ).toHaveLength(4);

    fireEvent.click(
      screen.getByRole("button", { name: "Show all 6 participants" }),
      { detail: 0 },
    );

    expect(
      screen.getByRole("switch", { name: "Use grid view" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("button", { name: /^Focus / })).toHaveLength(6);
  });
});
