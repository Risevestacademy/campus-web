import posthog from "posthog-js";

import { readAnalyticsConfiguration } from "./configuration";
import type {
  AnalyticsEventMap,
  AnalyticsEventName,
  AnalyticsIdentity,
} from "./events";

let isInitialized = false;

function safelyRunBrowserAnalytics(
  failureMessage: string,
  operation: () => void,
): void {
  try {
    operation();
  } catch (error) {
    console.error(failureMessage, error);
  }
}

export function initializeBrowserAnalytics(): boolean {
  if (isInitialized) {
    return true;
  }

  const configuration = readAnalyticsConfiguration();

  if (!configuration) {
    return false;
  }

  try {
    posthog.init(configuration.projectToken, {
      api_host: configuration.host,
      autocapture: false,
      capture_pageleave: false,
      capture_pageview: "history_change",
      defaults: "2026-01-30",
      disable_session_recording: true,
      person_profiles: "identified_only",
    });
    isInitialized = true;
    return true;
  } catch (error) {
    console.error("PostHog browser initialization failed.", error);
    return false;
  }
}

export function captureBrowserAnalyticsEvent<
  EventName extends AnalyticsEventName,
>(eventName: EventName, properties: AnalyticsEventMap[EventName]): void {
  if (!isInitialized) {
    return;
  }

  safelyRunBrowserAnalytics("PostHog browser event capture failed.", () =>
    posthog.capture(eventName, properties),
  );
}

export function identifyAnalyticsUser(identity: AnalyticsIdentity): void {
  if (!isInitialized) {
    return;
  }

  const distinctId = identity.id.trim();

  if (!distinctId) {
    console.error("PostHog user identification skipped: distinct ID is empty.");
    return;
  }

  safelyRunBrowserAnalytics("PostHog browser identification failed.", () => {
    posthog.identify(distinctId, {
      account_status: identity.accountStatus,
      cohort_id: identity.cohortId,
      role: identity.role,
      track_id: identity.trackId,
    });
  });
}

export function resetAnalyticsUser(): void {
  if (isInitialized) {
    safelyRunBrowserAnalytics("PostHog browser identity reset failed.", () =>
      posthog.reset(),
    );
  }
}
