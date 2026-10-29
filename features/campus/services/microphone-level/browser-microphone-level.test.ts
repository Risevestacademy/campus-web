import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestMediaTrack } from "../../testing/media-session-test-utils";
import { browserMicrophoneLevelMeter } from "./browser-microphone-level";

describe("browserMicrophoneLevelMeter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows no level, instead of failing, when the browser refuses audio analysis", () => {
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          throw new DOMException("too many contexts", "NotSupportedError");
        }
      },
    );
    vi.stubGlobal("MediaStream", class {});
    const render = vi.fn();

    const stop = browserMicrophoneLevelMeter.follow(
      createTestMediaTrack("audio", "mic-1"),
      render,
    );

    expect(stop).not.toThrow();
    expect(render).not.toHaveBeenCalled();
  });
});
