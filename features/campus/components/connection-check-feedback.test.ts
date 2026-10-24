import { describe, expect, it } from "vitest";

import type { ConnectionCheckResult } from "../services/connection-check/check-connection";
import { describeConnectionCheck } from "./connection-check-feedback";

const COULD_NOT_RUN = {
  title: "We couldn't run the test. Try again in a moment.",
};

describe("describeConnectionCheck", () => {
  it.each<
    [string, ConnectionCheckResult, ReturnType<typeof describeConnectionCheck>]
  >([
    [
      "a pass",
      { kind: "passed" },
      { title: "Your connection is ready for calls." },
    ],
    [
      "a blocked network",
      { kind: "step-failed", step: "network" },
      {
        title: "Your network is blocking calls.",
        hint: "Try another network, or ask whoever runs it to allow video calls.",
      },
    ],
    [
      "a microphone that cannot send",
      { kind: "step-failed", step: "microphone" },
      {
        title: "Your microphone couldn't send audio.",
        hint: "Check it isn't muted or in use by another app.",
      },
    ],
    [
      "a camera that cannot send",
      { kind: "step-failed", step: "camera" },
      {
        title: "Your camera couldn't send video.",
        hint: "Close other apps that use the camera.",
      },
    ],
    [
      "a rate limit",
      { kind: "rate-limited", retryAfterSeconds: 42 },
      { title: "You've tested a few times. Try again in 42 seconds." },
    ],
    [
      "a deployment without calls",
      { kind: "unavailable" },
      { title: "Calls aren't available on this campus yet." },
    ],
    ["a refused session", { kind: "signed-out" }, COULD_NOT_RUN],
    ["a refused origin", { kind: "misconfigured" }, COULD_NOT_RUN],
    ["a failed request", { kind: "failed" }, COULD_NOT_RUN],
  ])("describes %s", (_, result, expected) => {
    expect(describeConnectionCheck(result)).toEqual(expected);
  });

  it("says one second, not one seconds", () => {
    expect(
      describeConnectionCheck({ kind: "rate-limited", retryAfterSeconds: 1 }),
    ).toEqual({ title: "You've tested a few times. Try again in 1 second." });
  });
});
