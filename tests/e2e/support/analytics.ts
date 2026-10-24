import type { BrowserContext } from "@playwright/test";

const POSTHOG = /^https:\/\/([a-z0-9-]+\.)*posthog\.com\//;

// Builds carry the real project token, so posthog-js would reach PostHog.
export async function blockPostHog(context: BrowserContext) {
  await context.route(POSTHOG, (route) => route.abort("blockedbyclient"));
}

// Every page starts as if Reject was pressed, so the banner never opens over a
// test: pressing Reject on sight closed whatever menu was open. The key holds
// the build's token, unknown here, so any unset consent key reads as "0".
export async function rejectAnalyticsUpFront(context: BrowserContext) {
  await context.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      const value = getItem.call(this, key);
      return value === null && key.startsWith("__ph_opt_in_out_") ? "0" : value;
    };
  });
}
