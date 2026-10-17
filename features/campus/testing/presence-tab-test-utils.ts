import { vi } from "vitest";

import type { MeetingMediaTransport } from "../services/media-session/contracts";
import { createMediaSessionStore } from "../services/media-session/media-session-store";
import type {
  PresenceTab,
  PresenceTabStatus,
} from "../services/presence-session/presence-tab";
import {
  createTestMediaDevice,
  createTestMediaTrack,
  type TestMediaTrack,
} from "./media-session-test-utils";

export type TestPresenceTab = PresenceTab &
  Readonly<{
    claim: ReturnType<typeof vi.fn<PresenceTab["claim"]>>;
    setStatus: (status: PresenceTabStatus) => void;
    takeOver: ReturnType<typeof vi.fn<PresenceTab["takeOver"]>>;
  }>;

// A Presence Tab whose status the test sets. Claim and take-over succeed and
// hold the cohort unless a test overrides them.
export function createTestPresenceTab(
  initialStatus: PresenceTabStatus = "vacant",
): TestPresenceTab {
  const listeners = new Set<() => void>();
  let status = initialStatus;

  function setStatus(next: PresenceTabStatus) {
    status = next;
    for (const listener of listeners) listener();
  }

  return {
    claim: vi.fn(async () => {
      setStatus("held");
      return true;
    }),
    getStatus: () => status,
    open: () => () => {},
    setStatus,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    takeOver: vi.fn(async () => setStatus("held")),
  };
}

function createOwnedStream(): MediaStream {
  const tracks: MediaStreamTrack[] = [];

  return {
    addTrack: (track: MediaStreamTrack) => tracks.push(track),
    getAudioTracks: () => tracks.filter((track) => track.kind === "audio"),
    getTracks: () => [...tracks],
    getVideoTracks: () => tracks.filter((track) => track.kind === "video"),
    removeTrack: (track: MediaStreamTrack) => {
      const index = tracks.indexOf(track);
      if (index >= 0) tracks.splice(index, 1);
    },
  } as unknown as MediaStream;
}

// A real media session over fake devices and transport that counts what is
// live, so tests can prove a tab holds no capture or connection.
export function createCountingMediaSession() {
  const captured: TestMediaTrack[] = [];
  let connections = 0;
  const mediaDevices = Object.assign(new EventTarget(), {
    enumerateDevices: vi
      .fn()
      .mockResolvedValue([
        createTestMediaDevice("camera-1", "videoinput", "Studio Camera"),
        createTestMediaDevice("microphone-1", "audioinput", "Studio Mic"),
      ]),
    getUserMedia: vi.fn(async (constraints: MediaStreamConstraints) => {
      const track = constraints.video
        ? createTestMediaTrack("video", "camera-1")
        : createTestMediaTrack("audio", "microphone-1");
      captured.push(track);
      const stream = createOwnedStream();
      stream.addTrack(track);
      return stream;
    }),
  }) as unknown as MediaDevices;
  const transport: MeetingMediaTransport = {
    connect() {
      connections += 1;
      return () => {
        connections -= 1;
      };
    },
    handleLocalPublicationChange() {},
  };

  return {
    liveConnections: () => connections,
    liveTracks: () =>
      captured.filter((track) => track.stop.mock.calls.length === 0).length,
    store: createMediaSessionStore({
      createMediaStream: createOwnedStream,
      mediaDevices,
      transport,
    }),
  };
}
