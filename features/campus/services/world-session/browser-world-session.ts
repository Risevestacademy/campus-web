import { publicEnvironment } from "@/config/environment/public";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import { createConsoleLogger } from "@/core/observability";
import { presenceFor } from "@/core/presence";
import {
  browserIsOnline,
  type RealtimeOutcome,
  subscribeToBrowserWake,
} from "@/core/realtime";
import { readWorldSocketUrl } from "@/core/realtime/configuration";
import type { RefreshSession } from "@/core/session";

import type { AnalyticsCapture } from "./realtime-analytics";
import { createWorldSession, type WorldSession } from "./world-session";

function captureRealtimeEvent([name, properties]: AnalyticsCapture) {
  captureBrowserAnalyticsEvent(name, properties);
}

export function createBrowserWorldSession(
  cohortId: string,
  ports: {
    refreshSession: RefreshSession;
    onOutcome: (outcome: RealtimeOutcome) => void;
  },
): WorldSession {
  return createWorldSession({
    url: readWorldSocketUrl(publicEnvironment, cohortId),
    cohortId,
    presence: presenceFor(cohortId),
    refreshSession: ports.refreshSession,
    captureEvent: captureRealtimeEvent,
    onOutcome: ports.onOutcome,
    createSocket: (url) => new WebSocket(url),
    logger: createConsoleLogger(),
    isOnline: browserIsOnline,
    subscribeToWake: subscribeToBrowserWake,
  });
}
