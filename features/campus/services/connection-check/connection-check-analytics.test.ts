import { describe, expect, it } from "vitest";

import type { ConnectionCheckResult } from "./check-connection";
import { connectionCheckEventProperties } from "./connection-check-analytics";

describe("connectionCheckEventProperties", () => {
  it.each<[ConnectionCheckResult | "crashed", unknown]>([
    [{ kind: "passed" }, { result: "passed", failed_step: null }],
    [
      { kind: "step-failed", step: "network" },
      { result: "failed", failed_step: "network" },
    ],
    [
      { kind: "step-failed", step: "microphone" },
      { result: "failed", failed_step: "microphone" },
    ],
    [
      { kind: "step-failed", step: "camera" },
      { result: "failed", failed_step: "camera" },
    ],
    [{ kind: "unavailable" }, { result: "unavailable", failed_step: null }],
    [
      { kind: "rate-limited", retryAfterSeconds: 42 },
      { result: "rate_limited", failed_step: null },
    ],
    [{ kind: "signed-out" }, { result: "signed_out", failed_step: null }],
    [{ kind: "failed" }, { result: "error", failed_step: null }],
    ["crashed", { result: "error", failed_step: null }],
  ])("reports %o as %o", (outcome, expected) => {
    expect(connectionCheckEventProperties(outcome)).toEqual(expected);
  });
});
