function normalizeEnvironmentValue(
  value: string | undefined,
): string | undefined {
  return value?.trim() || undefined;
}

export const publicEnvironment = Object.freeze({
  NEXT_PUBLIC_POSTHOG_HOST: normalizeEnvironmentValue(
    process.env.NEXT_PUBLIC_POSTHOG_HOST,
  ),
  NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: normalizeEnvironmentValue(
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
  ),
  NEXT_PUBLIC_SANITY_DATASET: normalizeEnvironmentValue(
    process.env.NEXT_PUBLIC_SANITY_DATASET,
  ),
  NEXT_PUBLIC_SANITY_PROJECT_ID: normalizeEnvironmentValue(
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  ),
  NEXT_PUBLIC_WORLD_URL: normalizeEnvironmentValue(
    process.env.NEXT_PUBLIC_WORLD_URL,
  ),
});
