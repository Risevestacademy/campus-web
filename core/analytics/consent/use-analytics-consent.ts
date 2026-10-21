import { useSyncExternalStore } from "react";

import {
  acceptAnalyticsConsent,
  getAnalyticsConsentSnapshot,
  getServerAnalyticsConsentSnapshot,
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
    isOpen: isConsentChoiceOpen(snapshot),
    accept: acceptAnalyticsConsent,
    reject: rejectAnalyticsConsent,
  };
}
