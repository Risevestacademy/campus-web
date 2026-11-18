import { useSyncExternalStore } from "react";

import {
  acceptAnalyticsConsent,
  closeAnalyticsConsentChoices,
  getAnalyticsConsentSnapshot,
  getServerAnalyticsConsentSnapshot,
  isConsentChoiceKnown,
  isConsentChoiceOpen,
  rejectAnalyticsConsent,
  subscribeToAnalyticsConsent,
  toggleAnalyticsConsentChoices,
} from "./consent-store";

export function useAnalyticsConsent() {
  const snapshot = useSyncExternalStore(
    subscribeToAnalyticsConsent,
    getAnalyticsConsentSnapshot,
    getServerAnalyticsConsentSnapshot,
  );

  return {
    // "unknown" until the stored choice is read; "unavailable" where analytics
    // is not set up.
    consent: snapshot.consent,
    canReopen: isConsentChoiceKnown(snapshot),
    isOpen: isConsentChoiceOpen(snapshot),
    isReviewing: snapshot.reviewing,
    accept: acceptAnalyticsConsent,
    reject: rejectAnalyticsConsent,
    close: closeAnalyticsConsentChoices,
    toggle: toggleAnalyticsConsentChoices,
  };
}
