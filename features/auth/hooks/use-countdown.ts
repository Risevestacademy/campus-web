import { useState } from "react";

import { useMountEffect } from "./use-mount-effect";

const TICK_MS = 250;

export function useCountdown(durationMs: number): number {
  const [endsAt] = useState(() => Date.now() + durationMs);
  const [now, setNow] = useState(() => Date.now());

  useMountEffect(() => {
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt) clearInterval(interval);
    }, TICK_MS);
    return () => clearInterval(interval);
  });

  return Math.max(0, endsAt - now);
}
