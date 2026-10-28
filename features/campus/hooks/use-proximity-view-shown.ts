import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import { ANALYTICS_EVENTS } from "@/core/analytics/events";
import { useMountEffect } from "@/shared/lib/use-mount-effect";

export function useProximityViewShown() {
  useMountEffect(() => {
    captureBrowserAnalyticsEvent(
      ANALYTICS_EVENTS.CAMPUS_PROXIMITY_VIEW_SHOWN,
      {},
    );
  });
}
