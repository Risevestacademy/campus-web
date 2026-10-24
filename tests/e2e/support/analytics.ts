import type { BrowserContext } from "@playwright/test";

import { ANALYTICS_CONSENT_KEY } from "@/core/analytics/consent-key";

const POSTHOG = /^https:\/\/([a-z0-9-]+\.)*posthog\.com\//;

// Builds carry the real project token, so posthog-js would reach PostHog.
export async function blockPostHog(context: BrowserContext) {
  await context.route(POSTHOG, (route) => route.abort("blockedbyclient"));
}

// Stored before any page script runs, so the banner never opens over a test.
// about:blank frames have no storage and throw; nothing there needs it.
export async function rejectAnalyticsUpFront(context: BrowserContext) {
  await context.addInitScript((key) => {
    try {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, "0");
    } catch {
      return;
    }
  }, ANALYTICS_CONSENT_KEY);
}
