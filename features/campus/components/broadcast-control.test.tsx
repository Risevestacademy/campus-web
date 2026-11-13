import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BroadcastMessage } from "@/core/realtime";
import { Toaster } from "@/shared/ui/toast";
import {
  applyFrame,
  clearPresence,
  seedPresence,
} from "@/tests/fixtures/nearby-presence";

import { useBroadcastSpeakingFeedback } from "../hooks/use-broadcast-speaking-feedback";
import type {
  BroadcastSpeaking,
  MeetingMediaTransport,
  MeetingMediaTransportCallbacks,
} from "../services/media-session/contracts";
import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../services/media-session/media-session-store";
import { BroadcastControl } from "./broadcast-control";

const COHORT_ID = "broadcast-control-cohort";

function broadcastFrame(canSpeak: boolean): BroadcastMessage {
  return {
    type: "broadcast",
    call: {
      url: "wss://media.example.test",
      room: "cohort-broadcast",
      token: "broadcast-token",
      canSpeak,
    },
  };
}

function FeedbackProbe() {
  useBroadcastSpeakingFeedback();
  return null;
}

function renderControl() {
  let callbacks: MeetingMediaTransportCallbacks | undefined;
  const setBroadcastSpeaking = vi.fn();
  const transport: MeetingMediaTransport = {
    connect(next) {
      callbacks = next;
      return () => undefined;
    },
    handleLocalPublicationChange() {},
    retry() {},
    setBroadcastSpeaking,
    setVideoDemand() {},
  };
  const store = createMediaSessionStore({ mediaDevices: null, transport });
  store.getState().connect();
  render(
    <MediaSessionProvider store={store}>
      <BroadcastControl cohortId={COHORT_ID} />
      <FeedbackProbe />
      <Toaster />
    </MediaSessionProvider>,
  );

  return {
    report(speaking: BroadcastSpeaking) {
      act(() => callbacks?.onBroadcastSpeakingChange(speaking));
    },
    setBroadcastSpeaking,
    store,
  };
}

describe("BroadcastControl", () => {
  afterEach(() => clearPresence(COHORT_ID));

  it("is offered only to a member World lets speak", () => {
    seedPresence(COHORT_ID);
    renderControl();
    expect(
      screen.queryByRole("button", { name: "Speak to everyone" }),
    ).not.toBeInTheDocument();

    act(() => applyFrame(COHORT_ID, broadcastFrame(false)));
    expect(
      screen.queryByRole("button", { name: "Speak to everyone" }),
    ).not.toBeInTheDocument();

    act(() => applyFrame(COHORT_ID, broadcastFrame(true)));
    expect(
      screen.getByRole("button", { name: "Speak to everyone" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("shows the broadcast on, and stops it", async () => {
    seedPresence(COHORT_ID);
    applyFrame(COHORT_ID, broadcastFrame(true));
    const { report, setBroadcastSpeaking } = renderControl();

    report("on");
    const button = screen.getByRole("button", {
      name: "Stop speaking to everyone",
    });
    expect(button).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(button);
    await waitFor(() =>
      expect(setBroadcastSpeaking).toHaveBeenCalledExactlyOnceWith(false),
    );
  });

  it("warns when the broadcast room refuses the member's voice, until it is on again", async () => {
    seedPresence(COHORT_ID);
    applyFrame(COHORT_ID, broadcastFrame(true));
    const { report } = renderControl();

    report("on");
    report("failed");
    expect(
      await screen.findAllByText("Your voice isn't reaching everyone"),
    ).not.toHaveLength(0);

    report("on");
    await waitFor(() =>
      expect(
        screen.queryAllByText("Your voice isn't reaching everyone"),
      ).toHaveLength(0),
    );
  });

  it("reports a microphone that cannot be turned on", async () => {
    seedPresence(COHORT_ID);
    applyFrame(COHORT_ID, broadcastFrame(true));
    const { setBroadcastSpeaking, store } = renderControl();
    store.setState({
      toggleBroadcastSpeaking: async () => "permission-denied",
    });

    fireEvent.click(screen.getByRole("button", { name: "Speak to everyone" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(setBroadcastSpeaking).not.toHaveBeenCalled();
  });
});
