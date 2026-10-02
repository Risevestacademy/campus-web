"use client";

import { Button } from "@/shared/ui/button";

import { useCountdown } from "../hooks/use-countdown";
import { useSessionRefresh } from "../hooks/use-session-refresh";

interface RefreshSessionProps {
  returnTo: string;
}

interface RetryControlProps {
  cooldownMs: number;
  onRetry: () => void;
}

function RetryControl({ cooldownMs, onRetry }: RetryControlProps) {
  const remainingMs = useCountdown(cooldownMs);
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  return (
    <div className="mt-6 grid justify-items-center gap-3">
      <Button
        size="lg"
        className="min-w-72"
        disabled={remainingMs > 0}
        onClick={onRetry}
      >
        Try again
      </Button>
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {remainingMs > 0
          ? `You can try again in ${remainingSeconds} ${remainingSeconds === 1 ? "second" : "seconds"}.`
          : null}
      </p>
    </div>
  );
}

export function RefreshSession({ returnTo }: RefreshSessionProps) {
  const { state, retry } = useSessionRefresh(returnTo);

  if (state.status === "pending") {
    return (
      <p role="status" className="text-center">
        Restoring your session…
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div role="alert">
        <h1 className="font-display text-3xl font-bold">
          We couldn&apos;t restore your session
        </h1>
        <p className="mt-4 max-w-96">
          Campus could not reach the sign-in service. You are still signed in if
          your session is valid; try again in a moment.
        </p>
      </div>
      <RetryControl
        key={state.failures}
        cooldownMs={state.cooldownMs}
        onRetry={retry}
      />
    </div>
  );
}
