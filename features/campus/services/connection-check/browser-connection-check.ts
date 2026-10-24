import { publicEnvironment } from "@/config/environment/public";
import { readWorldOrigin } from "@/core/realtime/configuration";

import {
  checkConnection,
  type ConnectionCheckResult,
} from "./check-connection";
import { requestConnectionCheck } from "./connection-check.service";
import { loadLivekitProbe } from "./livekit-probe";
import { readMediaOrigin } from "./media-origin";
import type {
  ConnectionCheckRunOptions,
  LiveTracks,
} from "./run-connection-check";

export function checkBrowserConnection(
  tracks: LiveTracks,
  options: ConnectionCheckRunOptions,
): Promise<ConnectionCheckResult> {
  return checkConnection(
    {
      requestAccess: (signal) =>
        requestConnectionCheck(
          {
            fetch: (input, init) => globalThis.fetch(input, init),
            worldOrigin: readWorldOrigin(publicEnvironment),
            mediaOrigin: readMediaOrigin(publicEnvironment),
          },
          signal,
        ),
      loadProbe: (grant) => loadLivekitProbe(grant),
    },
    tracks,
    options,
  );
}

// An invalid value still counts: pressing the test then reads "couldn't run".
export function isConnectionCheckConfigured(): boolean {
  return publicEnvironment.NEXT_PUBLIC_MEDIA_URL !== undefined;
}
