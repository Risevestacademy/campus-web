import { ANALYTICS_EVENTS } from "@/core/analytics";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import { replaceDocument } from "@/shared/lib/document-navigation";
import { useMountEffect } from "@/shared/lib/use-mount-effect";
import { toast } from "@/shared/ui/toast";

import {
  renewSession,
  sharedSessionExpiry,
  subscribeToWake,
  withSessionLock,
} from "../services/browser-session";
import { signInHref } from "../services/route-policy";
import {
  createSessionRenewal,
  type RenewalOutcome,
} from "../services/session-renewal";

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`;
}

// Never ends the Presence Session itself: leaving for sign-in is the member's
// choice, so the toast stays until they act on it.
function announceSessionEnded() {
  toast.add({
    title: "Your session ended",
    description: "Sign in again to keep using Campus.",
    type: "error",
    timeout: 0,
    actionProps: {
      children: "Sign in",
      onClick: () => replaceDocument(signInHref(currentPath())),
    },
  });
}

function reportRenewal({ kind, failedAttempts }: RenewalOutcome) {
  captureBrowserAnalyticsEvent(ANALYTICS_EVENTS.AUTH_SESSION_RENEWED, {
    outcome: kind,
    failed_attempts: failedAttempts,
  });
  if (kind === "expired") announceSessionEnded();
}

const sessionRenewal = createSessionRenewal({
  refresh: renewSession,
  withLock: withSessionLock,
  sharedExpiry: sharedSessionExpiry,
  subscribeToWake,
  report: reportRenewal,
});

export function useSessionRenewal(expiresAt: string) {
  useMountEffect(() => sessionRenewal.start(expiresAt));
}
