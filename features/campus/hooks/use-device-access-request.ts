import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import { ANALYTICS_EVENTS } from "@/core/analytics/events";
import { useMountEffect } from "@/shared/lib/use-mount-effect";

import type { DeviceAccessOutcome } from "../services/media-session/contracts";
import { useMediaSession } from "../services/media-session/media-session-provider";

function recordPromptOutcome(outcome: DeviceAccessOutcome) {
  if (outcome !== "granted" && outcome !== "declined" && outcome !== "failed")
    return;

  captureBrowserAnalyticsEvent(
    ANALYTICS_EVENTS.CAMPUS_DEVICE_ACCESS_REQUESTED,
    { outcome },
  );
}

export function useDeviceAccessRequest() {
  const requestDeviceAccess = useMediaSession(
    (state) => state.requestDeviceAccess,
  );

  useMountEffect(() => {
    void requestDeviceAccess().then(recordPromptOutcome);
  });
}
