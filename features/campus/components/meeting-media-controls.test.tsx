import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyFrame,
  clearPresence,
  GRACE,
  nearbyFrame,
  seedPresence,
} from "@/tests/fixtures/nearby-presence";

import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../services/media-session/media-session-store";
import {
  createTestMediaDevice,
  installTestMediaDevices,
} from "../testing/media-session-test-utils";
import { MeetingMediaControls } from "./meeting-media-controls";

const COHORT = "c-camera";

async function setUp() {
  installTestMediaDevices([
    createTestMediaDevice("camera-1", "videoinput", "FaceTime HD Camera"),
    createTestMediaDevice("mic-1", "audioinput", "Studio Microphone"),
  ]);
  const store = createMediaSessionStore({
    mediaDevices: navigator.mediaDevices,
  });
  await store.getState().start();
  return {
    store,
    renderControls: () =>
      render(
        <MediaSessionProvider store={store}>
          <MeetingMediaControls cohortId={COHORT} />
        </MediaSessionProvider>,
      ),
  };
}

const cameraControls = () =>
  screen.queryByRole("group", { name: "Camera controls" });

const meetingEnds = () => act(() => applyFrame(COHORT, nearbyFrame()));

afterEach(() => {
  clearPresence(COHORT);
  vi.unstubAllGlobals();
});

describe("MeetingMediaControls", () => {
  it("offers the camera only during a meeting, and the microphone always", async () => {
    seedPresence(COHORT);
    (await setUp()).renderControls();

    expect(cameraControls()).toBeNull();
    expect(
      screen.getByRole("group", { name: "Microphone controls" }),
    ).toBeInTheDocument();

    act(() => applyFrame(COHORT, nearbyFrame(GRACE)));
    expect(cameraControls()).toBeInTheDocument();

    meetingEnds();
    expect(cameraControls()).toBeNull();
  });

  it("keeps a camera turned on before any meeting in reach", async () => {
    seedPresence(COHORT);
    const { renderControls, store } = await setUp();
    await store.getState().toggleSource("camera");

    renderControls();

    expect(
      screen.getByRole("button", { name: "Turn off camera" }),
    ).toBeInTheDocument();
  });

  it("keeps a live camera in reach after the meeting, until it is turned off", async () => {
    seedPresence(COHORT, GRACE);
    (await setUp()).renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Turn on camera" }));
    const turnOff = await screen.findByRole("button", {
      name: "Turn off camera",
    });

    meetingEnds();
    expect(turnOff).toBeInTheDocument();

    fireEvent.click(turnOff);
    expect(cameraControls()).toBeNull();
  });
});
