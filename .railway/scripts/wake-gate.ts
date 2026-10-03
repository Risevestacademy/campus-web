export type Probe = {
  status: number;
  seconds: number;
};

export type WakeGateVerdict = {
  passed: boolean;
  coldSeconds: number;
  reason: string;
};

export type WarmSummary = {
  allSucceeded: boolean;
  medianSeconds: number;
  maxSeconds: number;
};

export const COLD_LOAD_LIMIT_SECONDS = 10;

// Railway documents that the first request to a sleeping service may get a
// 502 while the container boots. Anything else on wake is a real failure.
const TOLERATED_WAKE_STATUS = 502;

function isSuccess({ status }: Probe): boolean {
  return status >= 200 && status < 300;
}

function totalSeconds(probes: readonly Probe[]): number {
  return probes.reduce((sum, { seconds }) => sum + seconds, 0);
}

export function needsWakeRetry(firstProbe: Probe): boolean {
  return firstProbe.status === TOLERATED_WAKE_STATUS;
}

function verdictWithinLimit(
  probes: readonly Probe[],
  limitSeconds: number,
): WakeGateVerdict {
  const coldSeconds = totalSeconds(probes);
  const passed = coldSeconds <= limitSeconds;

  return {
    passed,
    coldSeconds,
    reason: passed
      ? `cold load ${coldSeconds.toFixed(2)}s within ${limitSeconds}s`
      : `cold load ${coldSeconds.toFixed(2)}s exceeds ${limitSeconds}s`,
  };
}

export function evaluateWakeGate(
  probes: readonly Probe[],
  limitSeconds = COLD_LOAD_LIMIT_SECONDS,
): WakeGateVerdict {
  const [firstProbe, retryProbe] = probes;

  if (!firstProbe) {
    return { passed: false, coldSeconds: 0, reason: "no probe was sent" };
  }

  if (isSuccess(firstProbe)) {
    return verdictWithinLimit([firstProbe], limitSeconds);
  }

  if (!needsWakeRetry(firstProbe)) {
    return {
      passed: false,
      coldSeconds: firstProbe.seconds,
      reason: `first request returned ${firstProbe.status}; only ${TOLERATED_WAKE_STATUS} is tolerated on wake`,
    };
  }

  if (!retryProbe || !isSuccess(retryProbe)) {
    return {
      passed: false,
      coldSeconds: totalSeconds(probes),
      reason: `request after the wake ${TOLERATED_WAKE_STATUS} returned ${retryProbe?.status ?? "nothing"}`,
    };
  }

  return verdictWithinLimit([firstProbe, retryProbe], limitSeconds);
}

export function summarizeWarm(probes: readonly Probe[]): WarmSummary {
  const sortedSeconds = probes
    .map(({ seconds }) => seconds)
    .sort((left, right) => left - right);
  const middle = Math.floor(sortedSeconds.length / 2);
  const lower = sortedSeconds[middle - 1] ?? 0;
  const upper = sortedSeconds[middle] ?? 0;
  const medianSeconds =
    sortedSeconds.length % 2 === 0 ? (lower + upper) / 2 : upper;

  return {
    allSucceeded: probes.length > 0 && probes.every(isSuccess),
    medianSeconds,
    maxSeconds: sortedSeconds.at(-1) ?? 0,
  };
}

export type BaselineRow = {
  date: string;
  target: string;
  wake: readonly Probe[];
  verdict: WakeGateVerdict;
  warm: WarmSummary;
  apiHealth?: Probe;
};

export function formatBaselineRow(row: BaselineRow): string {
  const wakeStatuses = row.wake.map(({ status }) => status).join(" → ");
  const apiHealth = row.apiHealth
    ? `${row.apiHealth.status} in ${row.apiHealth.seconds.toFixed(2)}s`
    : "n/a";

  return [
    "",
    row.date,
    row.target,
    `${row.verdict.coldSeconds.toFixed(2)}s`,
    wakeStatuses,
    `${row.warm.medianSeconds.toFixed(2)}s / ${row.warm.maxSeconds.toFixed(2)}s`,
    apiHealth,
    row.verdict.passed ? "pass" : "fail",
    "",
  ]
    .join(" | ")
    .trim();
}
