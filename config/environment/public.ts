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
});
