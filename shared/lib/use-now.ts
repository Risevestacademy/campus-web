import { useState } from "react";

import { useMountEffect } from "./use-mount-effect";

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useMountEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  });

  return now;
}
