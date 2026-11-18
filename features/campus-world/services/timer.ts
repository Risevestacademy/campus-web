export interface Timer {
  elapsedMs: () => number;
}

export function startTimer(now: () => number = () => performance.now()): Timer {
  const startedAt = now();
  return { elapsedMs: () => Math.round(now() - startedAt) };
}
