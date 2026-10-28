import { describe, expect, it } from "vitest";

import { isSpeaking, levelOf, nextDisplayedLevel } from "./microphone-level";

// A 440 Hz sine whose RMS sits at the given dBFS, 512 samples at 48 kHz.
function sineAt(dbfs: number): Float32Array {
  const amplitude = Math.SQRT2 * 10 ** (dbfs / 20);
  return Float32Array.from(
    { length: 512 },
    (_, index) => amplitude * Math.sin((2 * Math.PI * 440 * index) / 48_000),
  );
}

describe("levelOf", () => {
  it.each([
    { input: "silence", samples: new Float32Array(512), level: 0 },
    { input: "a whisper under the floor", samples: sineAt(-70), level: 0 },
    { input: "the floor", samples: sineAt(-55), level: 0 },
    { input: "normal speech", samples: sineAt(-35), level: 0.5 },
    { input: "loud speech", samples: sineAt(-15), level: 1 },
    { input: "clipping", samples: sineAt(-3), level: 1 },
  ])("reads $input as $level", ({ samples, level }) => {
    expect(levelOf(samples)).toBeCloseTo(level, 1);
  });
});

describe("nextDisplayedLevel", () => {
  it("jumps straight up to a louder level", () => {
    expect(nextDisplayedLevel(0.1, 0.8)).toBe(0.8);
  });

  it("falls back gradually once the voice stops", () => {
    expect(nextDisplayedLevel(0.5, 0)).toBeCloseTo(0.44);
  });
});

describe("isSpeaking", () => {
  it.each([
    { was: false, level: 0.2, speaking: false },
    { was: false, level: 0.25, speaking: true },
    { was: true, level: 0.2, speaking: true },
    { was: true, level: 0.15, speaking: false },
  ])(
    "was $was, level $level: speaking $speaking",
    ({ was, level, speaking }) => {
      expect(isSpeaking(was, level)).toBe(speaking);
    },
  );
});
