import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import { ANALYTICS_EVENTS } from "@/core/analytics/events";
import { useMountEffect } from "@/shared/lib/use-mount-effect";

export function useMissingInviteLinkShown() {
  useMountEffect(() => {
    captureBrowserAnalyticsEvent(
      ANALYTICS_EVENTS.INVITATION_MISSING_LINK_SHOWN,
      {},
    );
  });
}
