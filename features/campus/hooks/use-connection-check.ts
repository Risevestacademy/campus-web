import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { useMountEffect } from "@/shared/lib/use-mount-effect";

import { checkBrowserConnection } from "../services/connection-check/browser-connection-check";
import type { ConnectionCheckResult } from "../services/connection-check/check-connection";
import type {
  ConnectionCheckRunOptions,
  ConnectionCheckStep,
  ReadTrack,
  StepStatus,
} from "../services/connection-check/run-connection-check";
import { useMediaSessionStore } from "../services/media-session/media-session-provider";

type CheckConnection = (
  readTrack: ReadTrack,
  options: ConnectionCheckRunOptions,
) => Promise<ConnectionCheckResult>;

export type ConnectionCheckSteps = Readonly<
  Record<ConnectionCheckStep, StepStatus>
>;

const PENDING_STEPS: ConnectionCheckSteps = {
  network: "pending",
  microphone: "pending",
  camera: "pending",
};

const CRASHED: ConnectionCheckResult = { kind: "failed" };

export function useConnectionCheck(
  check: CheckConnection = checkBrowserConnection,
) {
  const mediaSession = useMediaSessionStore();
  const [steps, setSteps] = useState(PENDING_STEPS);
  const run = useRef<AbortController | null>(null);

  useMountEffect(() => () => run.current?.abort());

  const mutation = useMutation({
    mutationFn: (signal: AbortSignal) =>
      check((step) => mediaSession.getState()[step].track, {
        signal,
        onStep: (step, status) =>
          setSteps((current) => ({ ...current, [step]: status })),
      }),
    // Each run spends one of world's five checks a minute: never retry.
    retry: false,
    onSettled: () => {
      run.current = null;
    },
  });

  function start() {
    if (run.current) return;
    run.current = new AbortController();
    setSteps(PENDING_STEPS);
    mutation.mutate(run.current.signal);
  }

  return {
    start,
    isRunning: mutation.isPending,
    steps,
    result: mutation.isError ? CRASHED : mutation.data,
  };
}
