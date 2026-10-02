import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MediaPublication } from "../services/media-session/contracts";
import {
  createTestMediaStream,
  createTestMediaTrack,
} from "../testing/media-session-test-utils";
import { MediaPublicationOutput } from "./media-publication-output";

const originalSetSinkIdDescriptor = Object.getOwnPropertyDescriptor(
  HTMLMediaElement.prototype,
  "setSinkId",
);

function createPublication(
  enabled: boolean,
  source: "camera" | "microphone",
  origin: "local" | "remote" = "local",
): MediaPublication {
  const track = createTestMediaTrack(
    source === "camera" ? "video" : "audio",
    `${source}-1`,
  );
  const publication = {
    enabled,
    publicationId: `${origin}-${source}`,
    source,
    stream: createTestMediaStream([track]),
    track,
  };

  return origin === "remote"
    ? { ...publication, origin: "remote", participantId: "participant-2" }
    : { ...publication, origin: "local" };
}

describe("MediaPublicationOutput", () => {
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

  it("attaches a live camera publication and replaces the identity fallback", () => {
    const camera = createPublication(true, "camera");

    render(
      <MediaPublicationOutput
        fallbackInitials="AJ"
        fallbackLabel="Camera off"
        isLocal
        label="AJ video"
        videoPublication={camera}
      />,
    );

    const video = screen.getByLabelText("AJ video");
    expect(video).toHaveProperty("srcObject", camera.stream);
    expect(screen.queryByText("Camera off")).not.toBeInTheDocument();
  });

  it("routes remote audio to the selected output when the browser supports it", async () => {
    const setSinkId = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, "setSinkId", {
      configurable: true,
      value: setSinkId,
    });

    render(
      <MediaPublicationOutput
        audioPublication={createPublication(true, "microphone", "remote")}
        fallbackLabel="Waiting for video"
        isLocal={false}
        label="Participant video"
        outputDeviceId="speaker-2"
      />,
    );

    await waitFor(() => {
      expect(setSinkId).toHaveBeenCalledWith("speaker-2");
    });
  });
});
