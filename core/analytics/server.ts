import "server-only";

import { PostHog } from "posthog-node";

import { readAnalyticsConfiguration } from "./configuration";
import {
  allowAnalyticsProperties,
  allowDistinctId,
  type AnalyticsEventMap,
  type AnalyticsEventName,
} from "./events";

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
  const allowedDistinctId = allowDistinctId(distinctId);
  const allowedProperties = allowAnalyticsProperties(eventName, properties);
  if (!allowedDistinctId || !allowedProperties) return;

  const client = getServerClient();

  if (!client) {
    return;
  }

  try {
    await client.captureImmediate({
      distinctId: allowedDistinctId,
      event: eventName,
      properties: allowedProperties,
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : typeof error;
    console.error("PostHog server event capture failed.", name);
  }
}
