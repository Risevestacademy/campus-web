import { publicEnvironment } from "../../config/environment/public";

const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

export type AnalyticsConfiguration = Readonly<{
  host: string;
  projectToken: string;
}>;

export function readAnalyticsConfiguration():
  AnalyticsConfiguration | undefined {
  const projectToken = publicEnvironment.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

  if (!projectToken) {
    return undefined;
  }

  return {
    host: publicEnvironment.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_POSTHOG_HOST,
    projectToken,
  };
}
