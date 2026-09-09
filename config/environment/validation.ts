type BuildEnvironment = Readonly<Record<string, string | undefined>>;

function isProtectedBuild(environment: BuildEnvironment): boolean {
  return environment.CI === "true" || environment.VERCEL === "1";
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validateBuildEnvironment(environment: BuildEnvironment): void {
  if (!isProtectedBuild(environment)) {
    return;
  }

  const errors: string[] = [];

  const projectToken = environment.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
  const host = environment.NEXT_PUBLIC_POSTHOG_HOST?.trim();

  if (!projectToken) {
    errors.push("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is required.");
  } else if (!projectToken.startsWith("phc_")) {
    errors.push('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN must start with "phc_".');
  }

  if (!host) {
    errors.push("NEXT_PUBLIC_POSTHOG_HOST is required.");
  } else if (!isHttpsUrl(host)) {
    errors.push("NEXT_PUBLIC_POSTHOG_HOST must be a valid HTTPS URL.");
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid build environment:\n${errors
        .map((error) => `- ${error}`)
        .join("\n")}`,
    );
  }
}
