import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { CircleIcon } from "@phosphor-icons/react/dist/ssr/Circle";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/ssr/CircleNotch";
import { MinusCircleIcon } from "@phosphor-icons/react/dist/ssr/MinusCircle";
import { XCircleIcon } from "@phosphor-icons/react/dist/ssr/XCircle";
import { cn } from "cn";

import { Button } from "@/shared/ui/button";

import type { ConnectionCheckSteps } from "../hooks/use-connection-check";
import type { ConnectionCheckResult } from "../services/connection-check/check-connection";
import type {
  ConnectionCheckStep,
  StepStatus,
} from "../services/connection-check/run-connection-check";
import {
  type ConnectionCheckFeedback,
  describeConnectionCheck,
} from "./connection-check-feedback";

type ConnectionCheckPanelProps = Readonly<{
  steps: ConnectionCheckSteps;
  result: ConnectionCheckResult | undefined;
  isRunning: boolean;
  onStart: () => void;
}>;

const stepNames = {
  network: "Network",
  microphone: "Microphone",
  camera: "Camera",
} as const satisfies Record<ConnectionCheckStep, string>;

const statusViews = {
  pending: {
    label: "Waiting",
    Icon: CircleIcon,
    className: "text-muted-foreground",
  },
  running: {
    label: "Checking…",
    Icon: CircleNotchIcon,
    className: "text-muted-foreground",
  },
  passed: {
    label: "Working",
    Icon: CheckCircleIcon,
    className: "text-foreground",
  },
  failed: { label: "Failed", Icon: XCircleIcon, className: "text-destructive" },
  skipped: {
    label: "Off, not tested",
    Icon: MinusCircleIcon,
    className: "text-muted-foreground",
  },
} as const satisfies Record<
  StepStatus,
  { label: string; Icon: unknown; className: string }
>;

const RUNNING_FEEDBACK: ConnectionCheckFeedback = {
  title: "Testing your connection…",
};

function buttonLabel(isRunning: boolean, hasResult: boolean) {
  if (isRunning) return "Testing…";
  return hasResult ? "Test again" : "Test connection";
}

function StepList({ steps }: Readonly<{ steps: ConnectionCheckSteps }>) {
  return (
    <ul aria-label="Connection test steps" className="grid gap-1.5 text-sm">
      {(Object.keys(stepNames) as ConnectionCheckStep[]).map((step) => {
        const { label, Icon, className } = statusViews[steps[step]];
        return (
          <li className="flex items-center gap-2" key={step}>
            <Icon
              aria-hidden="true"
              className={cn(
                "size-4",
                className,
                steps[step] === "running" &&
                  "animate-spin motion-reduce:animate-none",
              )}
            />
            <span className="font-medium">{stepNames[step]}</span>
            <span className={className}>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}

// The live region stays mounted, empty and never display:none (so no
// empty:hidden), or screen readers can miss the first announcement.
export function ConnectionCheckPanel({
  steps,
  result,
  isRunning,
  onStart,
}: ConnectionCheckPanelProps) {
  const isUnavailable = !isRunning && result?.kind === "unavailable";
  const hasRun =
    isRunning || Object.values(steps).some((status) => status !== "pending");
  const feedback = isRunning
    ? RUNNING_FEEDBACK
    : result && describeConnectionCheck(result);

  return (
    <section
      aria-label="Connection test"
      className="mx-auto grid w-full max-w-160 justify-items-center gap-3"
    >
      {isUnavailable ? null : (
        // A natively disabled button drops keyboard focus to the top of the
        // page, so it stays focusable; :disabled styles then never match.
        <Button
          className="data-disabled:cursor-not-allowed data-disabled:opacity-50"
          disabled={isRunning}
          focusableWhenDisabled
          onClick={onStart}
          size="sm"
          type="button"
          variant="outline"
        >
          {buttonLabel(isRunning, result !== undefined)}
        </Button>
      )}

      {hasRun && !isUnavailable ? <StepList steps={steps} /> : null}

      <div className="grid gap-1 text-center text-sm" role="status">
        {feedback ? (
          <>
            <p className="font-medium">{feedback.title}</p>
            {feedback.hint ? (
              <p className="text-muted-foreground">{feedback.hint}</p>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
