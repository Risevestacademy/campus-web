import type { CaptureResult, Properties } from "posthog-js";
import { z } from "zod";

// Query parameters that name a view, never a person or a credential.
const ALLOWED_QUERY_PARAMS = new Set(["page", "view"]);

const webUrlSchema = z.url({ protocol: /^https?$/ });

export function stripUrlQuery(value: string): string {
  const parsed = webUrlSchema.safeParse(value);
  if (!parsed.success) return value;

  const url = new URL(parsed.data);
  for (const name of [...url.searchParams.keys()]) {
    if (!ALLOWED_QUERY_PARAMS.has(name)) url.searchParams.delete(name);
  }
  url.hash = "";
  return url.href;
}

function scrubProperties(properties: Properties): Properties {
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [
      key,
      typeof value === "string" ? stripUrlQuery(value) : value,
    ]),
  );
}

// PostHog copies URLs into $current_url, $referrer, and their $initial_ and
// $session_entry_ twins, so every URL-shaped value is cleaned, whatever its key.
export function scrubAnalyticsEvent(
  event: CaptureResult | null,
): CaptureResult | null {
  if (!event) return null;

  return {
    ...event,
    properties: scrubProperties(event.properties),
    ...(event.$set && { $set: scrubProperties(event.$set) }),
    ...(event.$set_once && { $set_once: scrubProperties(event.$set_once) }),
  };
}
