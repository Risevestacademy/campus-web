import { github, preserve, project, service } from "railway/iac";

type RailwayEnvironment = "production" | "staging";

const branchByEnvironment: Record<RailwayEnvironment, string> = {
  production: "main",
  staging: "dev",
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
  const frontendSource = github("Risevestacademy/campus-web", {
    branch: branchByEnvironment[environment],
    checkSuites: true,
  });
  const campusStorybook = service("campus-storybook", {
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
    source: frontendSource,
    build: {
      buildEnvironment: "V3",
      builder: "RAILPACK",
      watchPatterns: campusWebWatchPatterns,
    },
    replicas: { ams: 1 },
    env: {
      API_BASE_URL: preserve(),
      NEXT_PUBLIC_POSTHOG_HOST: preserve(),
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: preserve(),
    },
  });

  return project("campus-by-rise", {
    resources: [campusStorybook, campusWeb],
  });
}
