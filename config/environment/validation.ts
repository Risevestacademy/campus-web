import * as z from "zod";

type BuildEnvironment = Readonly<Record<string, string | undefined>>;

const SANITY_DATASET_PATTERN = /^[a-z]+$/;
// Sanity's own rule; it also keeps the ID a single label of the map API host.
const SANITY_PROJECT_ID_PATTERN = /^[-a-z0-9]+$/i;

function requiredVariable(name: string) {
  const error = `${name} is required.`;

  return z.string({ error }).trim().min(1, { error, abort: true });
}

const protectedBuildEnvironmentSchema = z.object({
  NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: requiredVariable(
    "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN",
  ).startsWith("phc_", {
    error: 'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN must start with "phc_".',
  }),
  NEXT_PUBLIC_POSTHOG_HOST: requiredVariable("NEXT_PUBLIC_POSTHOG_HOST").pipe(
    z.url({
      protocol: /^https$/,
      hostname: z.regexes.domain,
      error: "NEXT_PUBLIC_POSTHOG_HOST must be a valid HTTPS URL.",
    }),
  ),
  NEXT_PUBLIC_SANITY_PROJECT_ID: requiredVariable(
    "NEXT_PUBLIC_SANITY_PROJECT_ID",
  ).regex(SANITY_PROJECT_ID_PATTERN, {
    error:
      "NEXT_PUBLIC_SANITY_PROJECT_ID must contain only letters, numbers, and hyphens.",
  }),
  NEXT_PUBLIC_SANITY_DATASET: requiredVariable(
    "NEXT_PUBLIC_SANITY_DATASET",
  ).regex(SANITY_DATASET_PATTERN, {
    error: "NEXT_PUBLIC_SANITY_DATASET must contain only lowercase letters.",
  }),
});

function isProtectedBuild(environment: BuildEnvironment): boolean {
  return environment.CI === "true" || environment.VERCEL === "1";
}

// A URL failing both its protocol and hostname checks raises two identical issues.
function listIssues(error: z.ZodError): string {
  const messages = new Set(error.issues.map((issue) => issue.message));

  return [...messages].map((message) => `- ${message}`).join("\n");
}

export function validateBuildEnvironment(environment: BuildEnvironment): void {
  if (!isProtectedBuild(environment)) {
    return;
  }

  const result = protectedBuildEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    throw new Error(`Invalid build environment:\n${listIssues(result.error)}`);
  }
}
