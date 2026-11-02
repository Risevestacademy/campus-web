import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import { ANALYTICS_EVENTS } from "@/core/analytics/events";
import type { Hearing } from "@/core/presence";
import { useMountEffect } from "@/shared/lib/use-mount-effect";

export function useMeetingViewShown(hearing: Hearing) {
  useMountEffect(() => {
    captureBrowserAnalyticsEvent(ANALYTICS_EVENTS.CAMPUS_PROXIMITY_VIEW_SHOWN, {
      hearing,
    });
  });
}
