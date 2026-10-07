import type { PostHog } from "posthog-js";

import { readAnalyticsConfiguration } from "./configuration";
import type {
  AnalyticsEventMap,
  AnalyticsEventName,
  AnalyticsIdentity,
} from "./events";

let browserAnalytics: Promise<PostHog | null> | null = null;

async function loadBrowserAnalytics(): Promise<PostHog | null> {
  const configuration = readAnalyticsConfiguration();

  if (!configuration) {
    return null;
  }

  try {
    const { default: posthog } = await import("posthog-js");
    posthog.init(configuration.projectToken, {
      api_host: configuration.host,
      autocapture: false,
      capture_pageleave: false,
      capture_pageview: "history_change",
      defaults: "2026-01-30",
      disable_session_recording: true,
      person_profiles: "identified_only",
    });
    return posthog;
  } catch (error) {
    console.error("PostHog browser initialization failed.", error);
    return null;
  }
}

// The SDK loads as its own chunk, off the hydration path. Calls made while it
// loads chain onto the same promise, so they run afterwards in call order.
export function initializeBrowserAnalytics(): Promise<boolean> {
  browserAnalytics ??= loadBrowserAnalytics();
  return browserAnalytics.then((posthog) => posthog !== null);
}

function withBrowserAnalytics(
  failureMessage: string,
  operation: (posthog: PostHog) => void,
): void {
  void browserAnalytics?.then((posthog) => {
    if (!posthog) {
      return;
    }

    try {
      operation(posthog);
    } catch (error) {
      console.error(failureMessage, error);
    }
  });
}

export function captureBrowserAnalyticsEvent<
  EventName extends AnalyticsEventName,
>(eventName: EventName, properties: AnalyticsEventMap[EventName]): void {
  withBrowserAnalytics("PostHog browser event capture failed.", (posthog) =>
    posthog.capture(eventName, properties),
  );
}

export function identifyAnalyticsUser(identity: AnalyticsIdentity): void {
  if (!browserAnalytics) {
    return;
  }

  const distinctId = identity.id.trim();

  if (!distinctId) {
    console.error("PostHog user identification skipped: distinct ID is empty.");
    return;
  }

  withBrowserAnalytics("PostHog browser identification failed.", (posthog) =>
    posthog.identify(distinctId, {
      account_status: identity.accountStatus,
      cohort_id: identity.cohortId,
      role: identity.role,
      track_id: identity.trackId,
    }),
  );
}

export function resetAnalyticsUser(): void {
  withBrowserAnalytics("PostHog browser identity reset failed.", (posthog) =>
    posthog.reset(),
  );
}
