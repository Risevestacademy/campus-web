import type { ConnectionCheckResult } from "../services/connection-check/check-connection";
import type { ConnectionCheckStep } from "../services/connection-check/run-connection-check";

export type ConnectionCheckFeedback = Readonly<{
  title: string;
  hint?: string;
}>;

const stepFailures = {
  network: {
    title: "Your network is blocking calls.",
    hint: "Try another network, or ask whoever runs it to allow video calls.",
  },
  microphone: {
    title: "Your microphone couldn't send audio.",
    hint: "Check it isn't muted or in use by another app.",
  },
  camera: {
    title: "Your camera couldn't send video.",
    hint: "Close other apps that use the camera.",
  },
} as const satisfies Record<ConnectionCheckStep, ConnectionCheckFeedback>;

const COULD_NOT_RUN: ConnectionCheckFeedback = {
  title: "We couldn't run the test. Try again in a moment.",
};

function seconds(count: number) {
  return count === 1 ? "1 second" : `${count} seconds`;
}

export function describeConnectionCheck(
  result: ConnectionCheckResult,
): ConnectionCheckFeedback {
  switch (result.kind) {
    case "passed":
      return { title: "Your connection is ready for calls." };
    case "step-failed":
      return stepFailures[result.step];
    case "rate-limited":
      return {
        title: `You've tested a few times. Try again in ${seconds(result.retryAfterSeconds)}.`,
      };
    case "unavailable":
      return { title: "Calls aren't available on this campus yet." };
    case "signed-out":
    case "misconfigured":
    case "failed":
      return COULD_NOT_RUN;
  }
}
