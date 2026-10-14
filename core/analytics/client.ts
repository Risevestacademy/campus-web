import type { PostHog } from "posthog-js";

import { readAnalyticsConfiguration } from "./configuration";
import {
  allowAnalyticsIdentity,
  allowAnalyticsProperties,
  type AnalyticsEventMap,
  type AnalyticsEventName,
  type AnalyticsIdentity,
} from "./events";

// Invite links and returnTo values carry tokens and paths. Masking covers the
// first URL PostHog persists at init, which runs before before_send.
const PERSONAL_DATA_URL_PARAMS = ["token", "returnTo", "code", "state"];

let browserAnalytics: Promise<PostHog | null> | null = null;

// SDK errors can carry the request payload; the name is enough to triage.
function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

async function loadBrowserAnalytics(): Promise<PostHog | null> {
  const configuration = readAnalyticsConfiguration();

  if (!configuration) {
    return null;
  }

  try {
    const [{ default: posthog }, { scrubAnalyticsEvent }] = await Promise.all([
      import("posthog-js"),
      import("./scrub"),
    ]);
    posthog.init(configuration.projectToken, {
      api_host: configuration.host,
      autocapture: false,
      before_send: scrubAnalyticsEvent,
      capture_dead_clicks: false,
      capture_exceptions: false,
      capture_heatmaps: false,
      capture_pageleave: false,
      capture_pageview: "history_change",
      custom_personal_data_properties: PERSONAL_DATA_URL_PARAMS,
      defaults: "2026-01-30",
      disable_session_recording: true,
      mask_personal_data_properties: true,
      person_profiles: "identified_only",
    });
    return posthog;
  } catch (error) {
    console.error("PostHog browser initialization failed.", errorName(error));
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
      console.error(failureMessage, errorName(error));
    }
  });
}

export function captureBrowserAnalyticsEvent<
  EventName extends AnalyticsEventName,
>(eventName: EventName, properties: AnalyticsEventMap[EventName]): void {
  const allowed = allowAnalyticsProperties(eventName, properties);
  if (!allowed) return;

  withBrowserAnalytics("PostHog browser event capture failed.", (posthog) =>
    posthog.capture(eventName, allowed),
  );
}

export function identifyAnalyticsUser(identity: AnalyticsIdentity): void {
  if (!browserAnalytics) {
    return;
  }

  const allowed = allowAnalyticsIdentity(identity);
  if (!allowed) return;

  withBrowserAnalytics("PostHog browser identification failed.", (posthog) =>
    posthog.identify(allowed.id, {
      account_status: allowed.accountStatus,
      cohort_id: allowed.cohortId,
      role: allowed.role,
      track_id: allowed.trackId,
    }),
  );
}

export function resetAnalyticsUser(): void {
  withBrowserAnalytics("PostHog browser identity reset failed.", (posthog) =>
    posthog.reset(),
  );
}
