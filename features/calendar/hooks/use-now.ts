import { useState } from "react";

import { useMountEffect } from "@/shared/lib/use-mount-effect";

const HALF_MINUTE = 30_000;

// The time, kept fresh so the line for now, LIVE and the Today list move on
// their own.
export function useNow(intervalMs: number = HALF_MINUTE): Date {
  const [now, setNow] = useState(() => new Date());

  useMountEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  });

  return now;
}
