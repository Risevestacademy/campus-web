import { vi } from "vitest";

// Drives the real posthog-js in jsdom. Needs posthog-js inlined in
// vitest.config.mts, so vi.resetModules() loads a fresh SDK singleton.

type AnalyticsClient = typeof import("@/core/analytics/client");

export async function loadRealAnalytics(): Promise<AnalyticsClient> {
  vi.resetModules();
  const analytics = await import("@/core/analytics/client");
  await analytics.initializeBrowserAnalytics();
  return analytics;
}

// Returns the URLs the SDK requested; nothing leaves the test.
export function stubPostHogEnvironment(token: string): string[] {
  const requests: string[] = [];
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", token);
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input instanceof Request ? input.url : input));
      return new Response("{}", { status: 200 });
    }),
  );
  return requests;
}

// Where posthog-js keeps the consent choice: "1" granted, "0" denied.
export function consentKey(token: string): string {
  return `__ph_opt_in_out_${token}`;
}

// PostHog starts opted out; a stored grant lets an eval reach capture.
export function grantStoredConsent(token: string): void {
  localStorage.setItem(consentKey(token), "1");
}

export function storedKeys(): string[] {
  const cookies = document.cookie
    .split(";")
    .map((cookie) => cookie.split("=")[0]?.trim() ?? "")
    .filter(Boolean);
  return [
    ...Object.keys(localStorage),
    ...Object.keys(sessionStorage),
    ...cookies,
  ];
}

export function clearBrowserStorage(): void {
  localStorage.clear();
  sessionStorage.clear();
  for (const name of storedKeys()) {
    document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
}
