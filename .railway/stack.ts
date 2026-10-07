import {
  github,
  type IntentServiceConfig,
  preserve,
  project,
  service,
} from "railway/iac";

type RailwayEnvironment = "production" | "staging";

const branchByEnvironment: Record<RailwayEnvironment, string> = {
  production: "main",
  staging: "dev",
};

// Production stays always-on until it gets its own cost review.
const sleepsWhenIdleByEnvironment: Record<RailwayEnvironment, boolean> = {
  production: false,
  staging: true,
};

const idleSleep = {
  deploy: { sleepApplication: true },
} satisfies IntentServiceConfig;

// Railway judges inactivity by outbound packets, so Next.js telemetry would
// keep the container awake; `next dev` must never be the inferred start.
const sleepFriendlyWebRuntime = {
  ...idleSleep,
  startCommand: "pnpm start",
  healthcheck: "/",
} satisfies IntentServiceConfig;

const sleepFriendlyWebEnvironment = {
  NEXT_TELEMETRY_DISABLED: "1",
};

const campusStorybookWatchPatterns = [
  "/.storybook/**",
  "/app/globals.css",
  "/assets/**",
  "/config/**",
  "/core/**",
  "/design-system/**",
  "/features/**",
  "/shared/**",
  "/next.config.ts",
  "/package.json",
  "/pnpm-lock.yaml",
  "/pnpm-workspace.yaml",
  "/postcss.config.mjs",
  "/tsconfig.json",
];

const campusWebWatchPatterns = [
  "/app/**",
  "/assets/**",
  "/config/**",
  "/core/**",
  "/features/**",
  "/public/**",
  "/shared/**",
  "/instrumentation-client.ts",
  "/next.config.ts",
  "/package.json",
  "/pnpm-lock.yaml",
  "/pnpm-workspace.yaml",
  "/postcss.config.mjs",
  "/tsconfig.json",
];

export function createFrontendProject(environment: RailwayEnvironment) {
  const sleepsWhenIdle = sleepsWhenIdleByEnvironment[environment];
  const frontendSource = github("Risevestacademy/campus-web", {
    branch: branchByEnvironment[environment],
    checkSuites: true,
  });
  const campusStorybook = service("campus-storybook", {
    ...(sleepsWhenIdle ? idleSleep : {}),
    source: frontendSource,
    build: {
      buildCommand: "pnpm storybook:build",
      buildEnvironment: "V3",
      builder: "RAILPACK",
      watchPatterns: campusStorybookWatchPatterns,
    },
    healthcheck: "/",
    replicas: { ams: 1 },
    env: {
      RAILPACK_SPA_OUTPUT_DIR: "storybook-static",
    },
  });
  const campusWeb = service("campus-web", {
    ...(sleepsWhenIdle ? sleepFriendlyWebRuntime : {}),
    source: frontendSource,
    build: {
      buildEnvironment: "V3",
      builder: "RAILPACK",
      watchPatterns: campusWebWatchPatterns,
    },
    replicas: { ams: 1 },
    env: {
      API_BASE_URL:
        "http://${{campus-api.RAILWAY_PRIVATE_DOMAIN}}:${{campus-api.PORT}}",
      NEXT_PUBLIC_POSTHOG_HOST: preserve(),
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: preserve(),
      ...(sleepsWhenIdle ? sleepFriendlyWebEnvironment : {}),
    },
  });

  return project("campus-by-rise", {
    resources: [campusStorybook, campusWeb],
  });
}
