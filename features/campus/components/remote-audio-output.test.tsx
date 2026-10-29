import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  MeetingMediaTransport,
  RemoteMediaPublication,
  RemotePublicationChange,
} from "../services/media-session/contracts";
import { MediaSessionProvider } from "../services/media-session/media-session-provider";
import { createMediaSessionStore } from "../services/media-session/media-session-store";
import {
  createTestMediaStream,
  createTestMediaTrack,
} from "../testing/media-session-test-utils";
import { RemoteAudioOutput } from "./remote-audio-output";

const originalSetSinkIdDescriptor = Object.getOwnPropertyDescriptor(
  HTMLMediaElement.prototype,
  "setSinkId",
);

function connectedSession() {
  let emit: (change: RemotePublicationChange) => void = () => undefined;
  const transport: MeetingMediaTransport = {
    connect(callbacks) {
      emit = callbacks.onRemotePublicationChange;
      return () => undefined;
    },
    handleLocalPublicationChange() {},
  };
  const store = createMediaSessionStore({ mediaDevices: null, transport });
  store.getState().connect();

  return {
    publish: (publication: RemoteMediaPublication) =>
      emit({ publication, type: "upserted" }),
    remove: (change: RemotePublicationChange) => emit(change),
    store,
  };
}

function remoteMicrophone(participantId: string): RemoteMediaPublication {
  const track = createTestMediaTrack("audio", `${participantId}-microphone`);

  return {
    enabled: true,
    origin: "remote",
    participantId,
    publicationId: `${participantId}-microphone`,
    source: "microphone",
    stream: createTestMediaStream([track]),
    track,
  };
}

describe("RemoteAudioOutput", () => {
  afterEach(() => {
    if (originalSetSinkIdDescriptor) {
      Object.defineProperty(
        HTMLMediaElement.prototype,
        "setSinkId",
        originalSetSinkIdDescriptor,
      );
      return;
    }

    Reflect.deleteProperty(HTMLMediaElement.prototype, "setSinkId");
  });

  it("plays each remote microphone once through the selected speaker", async () => {
    const setSinkId = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, "setSinkId", {
      configurable: true,
      value: setSinkId,
    });
    const { publish, store } = connectedSession();
    store.getState().selectOutputDevice("speaker-2");
    const microphone = remoteMicrophone("participant-2");

    render(
      <MediaSessionProvider store={store}>
        <RemoteAudioOutput />
      </MediaSessionProvider>,
    );
    act(() => publish(microphone));

    expect(screen.getByLabelText("participant-2 audio")).toHaveProperty(
      "srcObject",
      microphone.stream,
    );
    await waitFor(() => {
      expect(setSinkId).toHaveBeenCalledWith("speaker-2");
    });
  });

  it("keeps the same audio element while other participants change", () => {
    const { publish, store } = connectedSession();
    render(
      <MediaSessionProvider store={store}>
        <RemoteAudioOutput />
      </MediaSessionProvider>,
    );
    act(() => publish(remoteMicrophone("participant-2")));
    const firstAudio = screen.getByLabelText("participant-2 audio");

    act(() => publish(remoteMicrophone("participant-3")));

    expect(screen.getByLabelText("participant-2 audio")).toBe(firstAudio);
    expect(screen.getByLabelText("participant-3 audio")).toBeInTheDocument();
  });

  it("removes the audio when the participant stops publishing", () => {
    const { publish, remove, store } = connectedSession();
    render(
      <MediaSessionProvider store={store}>
        <RemoteAudioOutput />
      </MediaSessionProvider>,
    );
    act(() => publish(remoteMicrophone("participant-2")));

    act(() =>
      remove({
        participantId: "participant-2",
        publicationId: "participant-2-microphone",
        source: "microphone",
        type: "removed",
      }),
    );

    expect(
      screen.queryByLabelText("participant-2 audio"),
    ).not.toBeInTheDocument();
  });
});
