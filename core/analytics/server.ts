import "server-only";

import { PostHog } from "posthog-node";

import { readAnalyticsConfiguration } from "./configuration";
import type { AnalyticsEventMap, AnalyticsEventName } from "./events";

let serverClient: PostHog | undefined;

function getServerClient(): PostHog | undefined {
  const configuration = readAnalyticsConfiguration();

  if (!configuration) {
    return undefined;
  }

  serverClient ??= new PostHog(configuration.projectToken, {
    flushAt: 1,
    flushInterval: 0,
    host: configuration.host,
  });

  return serverClient;
}

export async function captureServerAnalyticsEvent<
  EventName extends AnalyticsEventName,
>(
  eventName: EventName,
  distinctId: string,
  properties: AnalyticsEventMap[EventName],
): Promise<void> {
  const normalizedDistinctId = distinctId.trim();

  if (!normalizedDistinctId) {
    console.error(
      "PostHog server event capture skipped: distinct ID is empty.",
    );
    return;
  }

  const client = getServerClient();

  if (!client) {
    return;
  }

  try {
    await client.captureImmediate({
      distinctId: normalizedDistinctId,
      event: eventName,
      properties,
    });
  } catch (error) {
    console.error("PostHog server event capture failed.", error);
  }
}
