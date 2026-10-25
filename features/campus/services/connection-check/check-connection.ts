import type { ConnectionCheckCompletedProperties } from "@/core/analytics/events";

import type { ConnectionCheckAccess } from "./connection-check.service";
import { connectionCheckEventProperties } from "./connection-check-analytics";
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
  captureEvent: (properties: ConnectionCheckCompletedProperties) => void;
}

// The media SDK loads only once world grants a token: a refusal never
// downloads it.
async function requestAndRun(
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

// One completed event per run that settled; an abandoned run reports nothing.
export async function checkConnection(
  dependencies: CheckConnectionDependencies,
  tracks: LiveTracks,
  options: ConnectionCheckRunOptions,
): Promise<ConnectionCheckResult> {
  try {
    const result = await requestAndRun(dependencies, tracks, options);
    dependencies.captureEvent(connectionCheckEventProperties(result));
    return result;
  } catch (error) {
    options.signal?.throwIfAborted();
    dependencies.captureEvent(connectionCheckEventProperties("crashed"));
    throw error;
  }
}
