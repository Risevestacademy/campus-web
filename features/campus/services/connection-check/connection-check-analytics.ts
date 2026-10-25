import type { ConnectionCheckCompletedProperties } from "@/core/analytics/events";

import type { ConnectionCheckResult } from "./check-connection";

type Result = ConnectionCheckCompletedProperties["result"];

const accessResults = {
  unavailable: "unavailable",
  "rate-limited": "rate_limited",
  "signed-out": "signed_out",
  misconfigured: "misconfigured",
  failed: "error",
} as const satisfies Record<
  Exclude<ConnectionCheckResult["kind"], "passed" | "step-failed">,
  Result
>;

// "failed" always means a step failed: a request or run that never got that
// far reports "error".
export function connectionCheckEventProperties(
  outcome: ConnectionCheckResult | "crashed",
): ConnectionCheckCompletedProperties {
  if (outcome === "crashed") return { result: "error", failed_step: null };

  switch (outcome.kind) {
    case "passed":
      return { result: "passed", failed_step: null };
    case "step-failed":
      return { result: "failed", failed_step: outcome.step };
    default:
      return { result: accessResults[outcome.kind], failed_step: null };
  }
}
