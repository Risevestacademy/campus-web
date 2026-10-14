import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MediaPublication } from "../services/media-session/contracts";
import {
  createTestMediaStream,
  createTestMediaTrack,
} from "../testing/media-session-test-utils";
import { MediaPublicationOutput } from "./media-publication-output";

function createCameraPublication(): MediaPublication {
  const track = createTestMediaTrack("video", "camera-1");

  return {
    enabled: true,
    origin: "local",
    publicationId: "local-camera",
    source: "camera",
    stream: createTestMediaStream([track]),
    track,
  };
}

describe("MediaPublicationOutput", () => {
  it("attaches a live camera publication and replaces the identity fallback", () => {
    const camera = createCameraPublication();

    render(
      <MediaPublicationOutput
        fallbackInitials="AJ"
        fallbackLabel="Camera off"
        label="AJ video"
        videoPublication={camera}
      />,
    );

    const video = screen.getByLabelText("AJ video");
    expect(video).toHaveProperty("srcObject", camera.stream);
    expect(screen.queryByText("Camera off")).not.toBeInTheDocument();
  });

  it("never plays audio, which belongs to the Presence Session output", () => {
    const { container } = render(
      <MediaPublicationOutput
        fallbackLabel="Waiting for video"
        label="Participant video"
        videoPublication={createCameraPublication()}
      />,
    );

    expect(container.querySelector("audio")).toBeNull();
  });
});
