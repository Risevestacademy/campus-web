import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BROADCAST_DUCKED_GAIN } from "../hooks/use-remote-audio-volume";
import type {
  BroadcastPublicationChange,
  MeetingMediaTransport,
  MeetingMediaTransportCallbacks,
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
  const callbacks = () => {
    if (!session) throw new Error("The transport was never connected.");
    return session;
  };

  return {
    broadcast: (publication: RemoteMediaPublication) =>
      callbacks().onBroadcastPublicationChange({
        publication: { ...publication, speakerName: null },
        type: "upserted",
      }),
    endBroadcast: (change: BroadcastPublicationChange) =>
      callbacks().onBroadcastPublicationChange(change),
    publish: (publication: RemoteMediaPublication) =>
      callbacks().onRemotePublicationChange({ publication, type: "upserted" }),
    remove: (change: RemotePublicationChange) =>
      callbacks().onRemotePublicationChange(change),
    setGains: (gains: Readonly<Record<string, number>>) =>
      callbacks().onRemoteAudioGainsChange(gains),
    store,
  };
}

function recordSourceChanges(element: HTMLElement) {
  const sources: unknown[] = [];
  let current: unknown = (element as HTMLMediaElement).srcObject;
  Object.defineProperty(element, "srcObject", {
    configurable: true,
    get: () => current,
    set: (source: unknown) => {
      current = source;
      sources.push(source);
    },
  });
  return sources;
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

  it("plays each microphone at its distance gain, and anyone without one silent", () => {
    const { publish, setGains, store } = connectedSession();
    render(
      <MediaSessionProvider store={store}>
        <RemoteAudioOutput />
      </MediaSessionProvider>,
    );

    act(() => {
      setGains({ "participant-2": 0.4 });
      publish(remoteMicrophone("participant-2"));
      publish(remoteMicrophone("participant-3"));
    });

    expect(screen.getByLabelText("participant-2 audio")).toHaveProperty(
      "volume",
      0.4,
    );
    expect(screen.getByLabelText("participant-3 audio")).toHaveProperty(
      "volume",
      0,
    );
  });

  it("follows a gain change without detaching the audio", () => {
    const { publish, setGains, store } = connectedSession();
    render(
      <MediaSessionProvider store={store}>
        <RemoteAudioOutput />
      </MediaSessionProvider>,
    );
    act(() => {
      setGains({ "participant-2": 1 });
      publish(remoteMicrophone("participant-2"));
    });
    const audio = screen.getByLabelText("participant-2 audio");
    const sourceChanges = recordSourceChanges(audio);

    act(() => setGains({ "participant-2": 0.25 }));

    expect(screen.getByLabelText("participant-2 audio")).toBe(audio);
    expect(audio).toHaveProperty("volume", 0.25);
    expect(sourceChanges).toEqual([]);
  });

  it("keeps playing, undetached, when the microphone mutes and unmutes", () => {
    const { publish, setGains, store } = connectedSession();
    render(
      <MediaSessionProvider store={store}>
        <RemoteAudioOutput />
      </MediaSessionProvider>,
    );
    const microphone = remoteMicrophone("participant-2");
    act(() => {
      setGains({ "participant-2": 1 });
      publish(microphone);
    });
    const audio = screen.getByLabelText("participant-2 audio");
    const sourceChanges = recordSourceChanges(audio);

    act(() => publish({ ...microphone, enabled: false }));
    act(() => publish(microphone));

    expect(screen.getByLabelText("participant-2 audio")).toBe(audio);
    expect(sourceChanges).toEqual([]);
  });

  it("stops following the gain once the audio is removed", () => {
    const { publish, remove, setGains, store } = connectedSession();
    render(
      <MediaSessionProvider store={store}>
        <RemoteAudioOutput />
      </MediaSessionProvider>,
    );
    act(() => {
      setGains({ "participant-2": 0.5 });
      publish(remoteMicrophone("participant-2"));
    });
    const audio = screen.getByLabelText("participant-2 audio");
    act(() =>
      remove({
        participantId: "participant-2",
        publicationId: "participant-2-microphone",
        source: "microphone",
        type: "removed",
      }),
    );

    act(() => setGains({ "participant-2": 1 }));

    expect(audio).toHaveProperty("volume", 0.5);
  });

  it("plays a broadcast at full volume through the selected speaker, beside the call", async () => {
    const setSinkId = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, "setSinkId", {
      configurable: true,
      value: setSinkId,
    });
    const { broadcast, publish, store } = connectedSession();
    store.getState().selectOutputDevice("speaker-2");
    const admin = remoteMicrophone("admin");
    render(
      <MediaSessionProvider store={store}>
        <RemoteAudioOutput />
      </MediaSessionProvider>,
    );

    act(() => {
      publish(remoteMicrophone("participant-2"));
      broadcast(admin);
    });

    const audio = screen.getByLabelText("admin broadcast audio");
    expect(audio).toHaveProperty("srcObject", admin.stream);
    expect(audio).toHaveProperty("volume", 1);
    expect(screen.getByLabelText("participant-2 audio")).toBeInTheDocument();
    await waitFor(() => {
      expect(setSinkId).toHaveBeenCalledTimes(2);
    });
  });

  it("ducks the space's call while a broadcast plays, without detaching it", () => {
    const { broadcast, endBroadcast, publish, setGains, store } =
      connectedSession();
    render(
      <MediaSessionProvider store={store}>
        <RemoteAudioOutput />
      </MediaSessionProvider>,
    );
    act(() => {
      setGains({ "participant-2": 0.8 });
      publish(remoteMicrophone("participant-2"));
    });
    const audio = screen.getByLabelText("participant-2 audio");
    const sourceChanges = recordSourceChanges(audio);

    act(() => broadcast(remoteMicrophone("admin")));
    expect(audio).toHaveProperty("volume", 0.8 * BROADCAST_DUCKED_GAIN);

    act(() =>
      endBroadcast({
        participantId: "admin",
        publicationId: "admin-microphone",
        source: "microphone",
        type: "removed",
      }),
    );
    expect(audio).toHaveProperty("volume", 0.8);
    expect(sourceChanges).toEqual([]);
  });

  it("stops ducking, and hears the admin in the call again, while their broadcast is muted", () => {
    const { broadcast, publish, setGains, store } = connectedSession();
    render(
      <MediaSessionProvider store={store}>
        <RemoteAudioOutput />
      </MediaSessionProvider>,
    );
    act(() => {
      setGains({ admin: 1, "participant-2": 0.8 });
      publish(remoteMicrophone("admin"));
      publish(remoteMicrophone("participant-2"));
      broadcast(remoteMicrophone("admin"));
    });
    const admin = screen.getByLabelText("admin audio");
    const other = screen.getByLabelText("participant-2 audio");

    act(() => broadcast({ ...remoteMicrophone("admin"), enabled: false }));
    expect(other).toHaveProperty("volume", 0.8);
    expect(admin).toHaveProperty("volume", 1);

    act(() => broadcast(remoteMicrophone("admin")));
    expect(other).toHaveProperty("volume", 0.8 * BROADCAST_DUCKED_GAIN);
    expect(admin).toHaveProperty("volume", 0);
  });

  it("hears a broadcasting admin from the broadcast only, never twice", () => {
    const { broadcast, publish, setGains, store } = connectedSession();
    render(
      <MediaSessionProvider store={store}>
        <RemoteAudioOutput />
      </MediaSessionProvider>,
    );
    act(() => {
      setGains({ admin: 1 });
      publish(remoteMicrophone("admin"));
      broadcast(remoteMicrophone("admin"));
    });

    expect(screen.getByLabelText("admin audio")).toHaveProperty("volume", 0);
    expect(screen.getByLabelText("admin broadcast audio")).toHaveProperty(
      "volume",
      1,
    );
  });
});
