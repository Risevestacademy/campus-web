// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  evaluateWakeGate,
  formatBaselineRow,
  needsWakeRetry,
  summarizeWarm,
} from "./wake-gate";

describe("evaluateWakeGate", () => {
  it("passes a first 200 within the cold-load limit", () => {
    expect(evaluateWakeGate([{ status: 200, seconds: 4.2 }])).toMatchObject({
      passed: true,
      coldSeconds: 4.2,
    });
  });

  it("passes at exactly the 10 second limit", () => {
    expect(evaluateWakeGate([{ status: 200, seconds: 10 }]).passed).toBe(true);
  });

  it("fails a first 200 slower than the limit", () => {
    expect(evaluateWakeGate([{ status: 200, seconds: 10.01 }])).toMatchObject({
      passed: false,
      reason: "cold load 10.01s exceeds 10s",
    });
  });

  it("tolerates one wake 502 and counts both requests toward the cold load", () => {
    expect(
      evaluateWakeGate([
        { status: 502, seconds: 3 },
        { status: 200, seconds: 2.5 },
      ]),
    ).toMatchObject({ passed: true, coldSeconds: 5.5 });
  });

  it("fails when the wake 502 and recovery together exceed the limit", () => {
    expect(
      evaluateWakeGate([
        { status: 502, seconds: 6 },
        { status: 200, seconds: 4.5 },
      ]).passed,
    ).toBe(false);
  });

  it("fails two 502s in a row as a persistent 5xx", () => {
    expect(
      evaluateWakeGate([
        { status: 502, seconds: 1 },
        { status: 502, seconds: 1 },
      ]),
    ).toMatchObject({
      passed: false,
      reason: "request after the wake 502 returned 502",
    });
  });

  it("fails a 502 with no follow-up request", () => {
    expect(evaluateWakeGate([{ status: 502, seconds: 1 }]).passed).toBe(false);
  });

  it.each([500, 503, 404, 0])(
    "fails a first %i because only 502 is tolerated on wake",
    (status) => {
      expect(evaluateWakeGate([{ status, seconds: 1 }]).passed).toBe(false);
    },
  );

  it("fails when no probe was sent", () => {
    expect(evaluateWakeGate([])).toEqual({
      passed: false,
      coldSeconds: 0,
      reason: "no probe was sent",
    });
  });

  it("honours a custom limit", () => {
    expect(evaluateWakeGate([{ status: 200, seconds: 3 }], 2).passed).toBe(
      false,
    );
  });
});

describe("needsWakeRetry", () => {
  it("retries only after a 502", () => {
    expect(needsWakeRetry({ status: 502, seconds: 1 })).toBe(true);
    expect(needsWakeRetry({ status: 503, seconds: 1 })).toBe(false);
    expect(needsWakeRetry({ status: 200, seconds: 1 })).toBe(false);
  });
});

describe("summarizeWarm", () => {
  it("reports the median and max of an odd sample", () => {
    expect(
      summarizeWarm([
        { status: 200, seconds: 0.3 },
        { status: 200, seconds: 0.1 },
        { status: 200, seconds: 0.2 },
      ]),
    ).toEqual({ allSucceeded: true, medianSeconds: 0.2, maxSeconds: 0.3 });
  });

  it("averages the middle pair of an even sample", () => {
    expect(
      summarizeWarm([
        { status: 200, seconds: 0.1 },
        { status: 200, seconds: 0.4 },
        { status: 200, seconds: 0.2 },
        { status: 200, seconds: 0.3 },
      ]).medianSeconds,
    ).toBeCloseTo(0.25);
  });

  it("flags any non-2xx warm response", () => {
    expect(
      summarizeWarm([
        { status: 200, seconds: 0.1 },
        { status: 500, seconds: 0.1 },
      ]).allSucceeded,
    ).toBe(false);
  });

  it("treats an empty sample as not succeeded", () => {
    expect(summarizeWarm([])).toEqual({
      allSucceeded: false,
      medianSeconds: 0,
      maxSeconds: 0,
    });
  });
});

describe("formatBaselineRow", () => {
  it("renders one markdown table row for the README baseline", () => {
    const wake = [
      { status: 502, seconds: 3 },
      { status: 200, seconds: 1.25 },
    ];

    expect(
      formatBaselineRow({
        date: "2026-10-03",
        target: "web /",
        wake,
        verdict: evaluateWakeGate(wake),
        warm: summarizeWarm([
          { status: 200, seconds: 0.12 },
          { status: 200, seconds: 0.2 },
          { status: 200, seconds: 0.15 },
        ]),
        apiHealth: { status: 200, seconds: 2.4 },
      }),
    ).toBe(
      "| 2026-10-03 | web / | 4.25s | 502 → 200 | 0.15s / 0.20s | 200 in 2.40s | pass |",
    );
  });

  it("marks the API health column n/a when it was not probed", () => {
    const wake = [{ status: 200, seconds: 0.8 }];

    expect(
      formatBaselineRow({
        date: "2026-10-03",
        target: "storybook /",
        wake,
        verdict: evaluateWakeGate(wake),
        warm: summarizeWarm([{ status: 200, seconds: 0.05 }]),
      }),
    ).toBe(
      "| 2026-10-03 | storybook / | 0.80s | 200 | 0.05s / 0.05s | n/a | pass |",
    );
  });
});
