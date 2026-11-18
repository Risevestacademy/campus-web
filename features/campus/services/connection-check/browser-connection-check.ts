import { publicEnvironment } from "@/config/environment/public";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import { ANALYTICS_EVENTS } from "@/core/analytics/events";
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
  ReadTrack,
} from "./run-connection-check";

export function checkBrowserConnection(
  readTrack: ReadTrack,
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
      captureEvent: (properties) =>
        captureBrowserAnalyticsEvent(
          ANALYTICS_EVENTS.CAMPUS_CONNECTION_CHECK_COMPLETED,
          properties,
        ),
    },
    readTrack,
    options,
  );
}

// An invalid value still counts: pressing the test then reads "couldn't run".
export function isConnectionCheckConfigured(): boolean {
  return publicEnvironment.NEXT_PUBLIC_MEDIA_URL !== undefined;
}
