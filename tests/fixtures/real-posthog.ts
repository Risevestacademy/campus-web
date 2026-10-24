import { gunzipSync } from "node:zlib";

import { vi } from "vitest";

import { ANALYTICS_CONSENT_KEY } from "@/core/analytics/consent-key";

// Drives the real posthog-js in jsdom. Needs posthog-js inlined in
// vitest.config.mts, so vi.resetModules() loads a fresh SDK singleton.

type AnalyticsClient = typeof import("@/core/analytics/client");

export async function loadRealAnalytics(): Promise<AnalyticsClient> {
  vi.resetModules();
  const analytics = await import("@/core/analytics/client");
  await analytics.initializeBrowserAnalytics();
  return analytics;
}

export type PostHogRequest = Readonly<{ url: string; events: string[] }>;

// Returns what the SDK requested, with the event names each body carried;
// nothing leaves the test.
export function stubPostHogEnvironment(token: string): PostHogRequest[] {
  const requests: PostHogRequest[] = [];
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", token);
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        url: String(input instanceof Request ? input.url : input),
        events: eventNames(init?.body),
      });
      return new Response("{}", { status: 200 });
    }),
  );
  return requests;
}

// Capture bodies are gzipped JSON; anything else is read as text.
function eventNames(body: BodyInit | null | undefined): string[] {
  if (!(body instanceof ArrayBuffer || ArrayBuffer.isView(body))) return [];
  const bytes = Buffer.from(body instanceof ArrayBuffer ? body : body.buffer);
  const text = isGzip(bytes) ? gunzipSync(bytes).toString() : bytes.toString();
  return [...text.matchAll(/"event":"([^"]+)"/g)].map(([, name]) => name ?? "");
}

function isGzip(bytes: Buffer): boolean {
  return bytes[0] === 0x1f && bytes[1] === 0x8b;
}

// PostHog starts opted out; a stored grant lets an eval reach capture.
export function grantStoredConsent(): void {
  localStorage.setItem(ANALYTICS_CONSENT_KEY, "1");
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
