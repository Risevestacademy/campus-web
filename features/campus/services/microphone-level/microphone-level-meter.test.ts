import { describe, expect, it, vi } from "vitest";

import { createTestMediaTrack } from "../../testing/media-session-test-utils";
import {
  createMicrophoneLevelMeter,
  type LevelAnalyser,
} from "./microphone-level-meter";

const LOUD = 0.5;

// Plays one buffer per frame: a constant LOUD sample or silence.
function scriptedAnalyser(frames: readonly ("loud" | "silent")[]) {
  let frame = 0;
  const analyser: LevelAnalyser = {
    read(samples) {
      samples.fill(frames[frame] === "loud" ? LOUD : 0);
      frame += 1;
    },
    release: vi.fn(),
    size: 64,
  };
  return analyser;
}

function manualFrames() {
  const pending = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  return {
    cancelFrame: (id: number) => pending.delete(id),
    requestFrame: (callback: FrameRequestCallback) => {
      nextId += 1;
      pending.set(nextId, callback);
      return nextId;
    },
    tick() {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(0);
    },
  };
}

describe("createMicrophoneLevelMeter", () => {
  it("renders the smoothed level and speaking state once a frame", () => {
    const frames = manualFrames();
    const analyser = scriptedAnalyser(["loud", "silent"]);
    const meter = createMicrophoneLevelMeter({
      ...frames,
      createAnalyser: () => analyser,
    });
    const render = vi.fn();

    meter.follow(createTestMediaTrack("audio", "mic-1"), render);
    frames.tick();
    frames.tick();

    expect(render.mock.calls).toEqual([
      [1, true],
      [0.88, true],
    ]);
  });

  it("stops reading and releases the analyser when it stops following", () => {
    const frames = manualFrames();
    const analyser = scriptedAnalyser(["loud", "loud"]);
    const meter = createMicrophoneLevelMeter({
      ...frames,
      createAnalyser: () => analyser,
    });
    const render = vi.fn();

    const stop = meter.follow(createTestMediaTrack("audio", "mic-1"), render);
    frames.tick();
    stop();
    frames.tick();

    expect(render).toHaveBeenCalledOnce();
    expect(analyser.release).toHaveBeenCalledOnce();
  });

  it("does nothing where the browser cannot analyse audio", () => {
    const frames = manualFrames();
    const meter = createMicrophoneLevelMeter({
      ...frames,
      createAnalyser: () => undefined,
    });
    const render = vi.fn();

    const stop = meter.follow(createTestMediaTrack("audio", "mic-1"), render);
    frames.tick();
    stop();

    expect(render).not.toHaveBeenCalled();
  });
});
