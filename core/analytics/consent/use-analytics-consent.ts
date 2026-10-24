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
} from "./consent-store";

export function useAnalyticsConsent() {
  const snapshot = useSyncExternalStore(
    subscribeToAnalyticsConsent,
    getAnalyticsConsentSnapshot,
    getServerAnalyticsConsentSnapshot,
  );

  return {
    canReopen: isConsentChoiceKnown(snapshot),
    isOpen: isConsentChoiceOpen(snapshot),
    isReviewing: snapshot.reviewing,
    accept: acceptAnalyticsConsent,
    reject: rejectAnalyticsConsent,
    close: closeAnalyticsConsentChoices,
  };
}
