import { publicEnvironment } from "@/config/environment/public";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import { createConsoleLogger } from "@/core/observability";
import { presenceFor } from "@/core/presence";
import {
  browserIsOnline,
  movementFor,
  subscribeToBrowserWake,
} from "@/core/realtime";
import { readWorldSocketUrl } from "@/core/realtime/configuration";

import type { AnalyticsCapture } from "./realtime-analytics";
import {
  createWorldSession,
  type WorldSession,
  type WorldSessionOptions,
} from "./world-session";

function captureRealtimeEvent([name, properties]: AnalyticsCapture) {
  captureBrowserAnalyticsEvent(name, properties);
}

export function createBrowserWorldSession(
  cohortId: string,
  ports: Pick<
    WorldSessionOptions,
    "onMessage" | "onOutcome" | "onRemoteParticipantsCleared" | "refreshSession"
  >,
): WorldSession {
  return createWorldSession({
    url: readWorldSocketUrl(publicEnvironment, cohortId),
    movement: movementFor(cohortId),
    presence: presenceFor(cohortId),
    ...ports,
    captureEvent: captureRealtimeEvent,
    createSocket: (url) => new WebSocket(url),
    logger: createConsoleLogger(),
    isOnline: browserIsOnline,
    subscribeToWake: subscribeToBrowserWake,
  });
}
