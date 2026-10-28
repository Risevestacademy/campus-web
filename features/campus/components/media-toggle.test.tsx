import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createTestMediaTrack } from "../testing/media-session-test-utils";
import { MediaToggle } from "./media-toggle";

function microphoneToggle(
  props: Readonly<{ isEnabled: boolean; levelTrack: MediaStreamTrack | null }>,
) {
  return (
    <MediaToggle
      error={null}
      kind="microphone"
      onToggle={async () => undefined}
      status="ready"
      {...props}
    />
  );
}

function levelFill(container: HTMLElement) {
  return container.querySelector("[data-slot=microphone-level]");
}

describe("MediaToggle", () => {
  it("fills the microphone with its level only while it is on", () => {
    const track = createTestMediaTrack("audio", "mic-1");
    const view = render(
      microphoneToggle({ isEnabled: true, levelTrack: track }),
    );

    expect(levelFill(view.container)).toBeInTheDocument();

    view.rerender(microphoneToggle({ isEnabled: false, levelTrack: track }));

    expect(levelFill(view.container)).not.toBeInTheDocument();
  });

  it("shows no level without a microphone track", () => {
    const view = render(
      microphoneToggle({ isEnabled: true, levelTrack: null }),
    );

    expect(levelFill(view.container)).not.toBeInTheDocument();
  });
});
