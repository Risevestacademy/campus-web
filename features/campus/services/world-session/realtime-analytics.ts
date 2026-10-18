import {
  ANALYTICS_EVENTS,
  type AnalyticsEventMap,
  type AnalyticsEventName,
} from "@/core/analytics";
import { isCloseReason, type RealtimeEvent } from "@/core/realtime";

export type AnalyticsCapture = {
  [Name in AnalyticsEventName]: [Name, AnalyticsEventMap[Name]];
}[AnalyticsEventName];

// A close reason is server text: only one this client knows leaves the app.
export function realtimeAnalytics(
  event: RealtimeEvent,
  cohortId: string,
): AnalyticsCapture[] {
  switch (event.type) {
    case "connected":
      return connected(event.attempt, cohortId);
    case "closed":
      return [
        [
          ANALYTICS_EVENTS.REALTIME_CLOSED,
          {
            code: event.code,
            reason: isCloseReason(event.reason) ? event.reason : "unknown",
            action: event.action,
          },
        ],
      ];
    case "stopped":
      return event.outcome === "gave-up"
        ? [[ANALYTICS_EVENTS.REALTIME_GAVE_UP, { attempts: event.attempts }]]
        : [];
    case "message":
      return [];
  }
}

// attempt counts the reconnects in a row; 0 is a first connect.
function connected(attempt: number, cohortId: string): AnalyticsCapture[] {
  const captures: AnalyticsCapture[] = [
    [
      ANALYTICS_EVENTS.REALTIME_CONNECTED,
      { cohort_id: cohortId, reconnect: attempt > 0 },
    ],
  ];
  if (attempt > 0) {
    captures.push([
      ANALYTICS_EVENTS.REALTIME_RECONNECTED,
      { attempts: attempt },
    ]);
  }
  return captures;
}
