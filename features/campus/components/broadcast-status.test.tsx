import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  clearPresence,
  GRACE,
  seedPresence,
} from "@/tests/fixtures/nearby-presence";

import type {
  BroadcastPublicationChange,
  MeetingMediaTransport,
  MeetingMediaTransportCallbacks,
} from "../services/media-session/contracts";
import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../services/media-session/media-session-store";
import {
  createTestMediaStream,
  createTestMediaTrack,
} from "../testing/media-session-test-utils";
import { broadcastHeadline, BroadcastStatus } from "./broadcast-status";

const COHORT_ID = "broadcast-status-cohort";
const UNKNOWN_ADMIN = "55555555-5555-4555-8555-555555555555";
const PLATFORM_ADMIN = "66666666-6666-4666-8666-666666666666";

function broadcastingSession() {
  let session: MeetingMediaTransportCallbacks | undefined;
  const transport: MeetingMediaTransport = {
    connect(callbacks) {
      session = callbacks;
      return () => undefined;
    },
    handleLocalPublicationChange() {},
    retry() {},
    setBroadcastSpeaking() {},
    setVideoDemand() {},
  };
  const store = createMediaSessionStore({ mediaDevices: null, transport });
  store.getState().connect();

  function change(change: BroadcastPublicationChange) {
    act(() => session?.onBroadcastPublicationChange(change));
  }

  return {
    speak(
      participantId: string,
      speakerName: string | null = null,
      enabled = true,
    ) {
      const track = createTestMediaTrack("audio", `${participantId}-mic`);
      change({
        publication: {
          enabled,
          origin: "remote",
          participantId,
          publicationId: `${participantId}-mic`,
          source: "microphone",
          speakerName,
          stream: createTestMediaStream([track]),
          track,
        },
        type: "upserted",
      });
    },
    stop(participantId: string) {
      change({
        participantId,
        publicationId: `${participantId}-mic`,
        source: "microphone",
        type: "removed",
      });
    },
    store,
  };
}

describe("broadcastHeadline", () => {
  it("names one speaker or several", () => {
    expect(broadcastHeadline(["Ada"])).toBe("Ada is speaking to everyone");
    expect(broadcastHeadline(["You"])).toBe("You are speaking to everyone");
    expect(broadcastHeadline(["Ada", "Grace", "Lin"])).toBe(
      "Ada, Grace, and Lin are speaking to everyone",
    );
  });
});

describe("BroadcastStatus", () => {
  afterEach(() => clearPresence(COHORT_ID));

  it("says who is broadcasting while they speak, and nothing after", () => {
    seedPresence(COHORT_ID, GRACE);
    const { speak, stop, store } = broadcastingSession();
    render(
      <MediaSessionProvider store={store}>
        <BroadcastStatus cohortId={COHORT_ID} />
      </MediaSessionProvider>,
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    speak(GRACE.userId);
    speak(UNKNOWN_ADMIN);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Grace Hopper and An admin are speaking to everyone",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    stop(GRACE.userId);
    stop(UNKNOWN_ADMIN);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("leaves out a speaker while they are muted", () => {
    seedPresence(COHORT_ID, GRACE);
    const { speak, store } = broadcastingSession();
    render(
      <MediaSessionProvider store={store}>
        <BroadcastStatus cohortId={COHORT_ID} />
      </MediaSessionProvider>,
    );

    speak(GRACE.userId, null, false);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    speak(GRACE.userId);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Grace Hopper is speaking to everyone",
    );
  });

  it("names an admin outside this cohort by the name in their token", () => {
    seedPresence(COHORT_ID);
    const { speak, store } = broadcastingSession();
    render(
      <MediaSessionProvider store={store}>
        <BroadcastStatus cohortId={COHORT_ID} />
      </MediaSessionProvider>,
    );

    speak(PLATFORM_ADMIN, "Lin Wei");

    expect(screen.getByRole("status")).toHaveTextContent(
      "Lin Wei is speaking to everyone",
    );
  });

  it("prefers the cohort's name for a member over the token's", () => {
    seedPresence(COHORT_ID, GRACE);
    const { speak, store } = broadcastingSession();
    render(
      <MediaSessionProvider store={store}>
        <BroadcastStatus cohortId={COHORT_ID} />
      </MediaSessionProvider>,
    );

    speak(GRACE.userId, "Old name");

    expect(screen.getByRole("status")).toHaveTextContent(
      "Grace Hopper is speaking to everyone",
    );
  });

  it("puts the member's own broadcast first", () => {
    seedPresence(COHORT_ID, GRACE);
    const { speak, store } = broadcastingSession();
    render(
      <MediaSessionProvider store={store}>
        <BroadcastStatus cohortId={COHORT_ID} />
      </MediaSessionProvider>,
    );

    act(() => store.setState({ broadcastSpeaking: "on" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "You are speaking to everyone",
    );

    speak(GRACE.userId);
    expect(screen.getByRole("status")).toHaveTextContent(
      "You and Grace Hopper are speaking to everyone",
    );
  });
});
