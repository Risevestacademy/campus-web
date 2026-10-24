import type { ConnectionCheckAccess } from "./connection-check.service";
import {
  type ConnectionCheckProbe,
  type ConnectionCheckRun,
  type ConnectionCheckRunOptions,
  type LiveTracks,
  runConnectionCheck,
} from "./run-connection-check";

type ReadyAccess = Extract<ConnectionCheckAccess, { kind: "ready" }>;

export type ConnectionCheckResult =
  Exclude<ConnectionCheckAccess, ReadyAccess> | ConnectionCheckRun;

export interface CheckConnectionDependencies {
  requestAccess: (signal?: AbortSignal) => Promise<ConnectionCheckAccess>;
  loadProbe: (
    grant: Omit<ReadyAccess, "kind">,
  ) => Promise<ConnectionCheckProbe>;
}

// The media SDK loads only once world grants a token: a refusal never
// downloads it.
export async function checkConnection(
  { requestAccess, loadProbe }: CheckConnectionDependencies,
  tracks: LiveTracks,
  options: ConnectionCheckRunOptions,
): Promise<ConnectionCheckResult> {
  const access = await requestAccess(options.signal);

  if (access.kind !== "ready") {
    return access;
  }

  const probe = await loadProbe({ url: access.url, token: access.token });

  return runConnectionCheck(probe, tracks, options);
}
