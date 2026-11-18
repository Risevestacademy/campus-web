"use client";

import { useConnectionCheck } from "../hooks/use-connection-check";
import { isConnectionCheckConfigured } from "../services/connection-check/browser-connection-check";
import { ConnectionCheckPanel } from "./connection-check-panel";

function ConfiguredConnectionCheck() {
  const { start, isRunning, steps, result } = useConnectionCheck();

  return (
    <ConnectionCheckPanel
      isRunning={isRunning}
      onStart={start}
      result={result}
      steps={steps}
    />
  );
}

export function ConnectionCheck() {
  return isConnectionCheckConfigured() ? <ConfiguredConnectionCheck /> : null;
}
