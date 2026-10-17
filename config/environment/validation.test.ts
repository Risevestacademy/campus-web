import { afterEach, describe, expect, it, vi } from "vitest";

import { validateBuildEnvironment } from "./validation";

const completeProtectedEnvironment = {
  CI: "true",
  NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
  NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "phc_project",
  NEXT_PUBLIC_SANITY_DATASET: "staging",
  NEXT_PUBLIC_SANITY_PROJECT_ID: "sj3zsz66",
  NEXT_PUBLIC_WORLD_URL: "https://ws.example.test",
};

const DATASET_MESSAGE =
  "NEXT_PUBLIC_SANITY_DATASET must be 1 to 64 lowercase letters, numbers, hyphens, or underscores, starting and ending with a letter or number.";
const WORLD_URL_MESSAGE =
  "NEXT_PUBLIC_WORLD_URL must be a public HTTPS origin.";

describe("build environment validation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("rejects a protected build when required public variables are missing", async () => {
    vi.stubEnv("CI", "true");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");
    vi.stubEnv("NEXT_PUBLIC_SANITY_PROJECT_ID", "");
    vi.stubEnv("NEXT_PUBLIC_SANITY_DATASET", "");
    vi.stubEnv("NEXT_PUBLIC_WORLD_URL", "");

    await expect(import("../../next.config")).rejects.toThrow(
      [
        "Invalid build environment:",
        "- NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is required.",
        "- NEXT_PUBLIC_POSTHOG_HOST is required.",
        "- NEXT_PUBLIC_SANITY_PROJECT_ID is required.",
        "- NEXT_PUBLIC_SANITY_DATASET is required.",
        "- NEXT_PUBLIC_WORLD_URL is required.",
      ].join("\n"),
    );
  });

  it("routes protected Storybook configuration through an isolated Next config", async () => {
    vi.stubEnv("CI", "true");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");

    const [{ default: storybookConfig }, { default: storybookNextConfig }] =
      await Promise.all([
        import("../../.storybook/main"),
        import("../../.storybook/next.config"),
      ]);

    expect(storybookConfig.framework).toMatchObject({
      name: "@storybook/nextjs-vite",
      options: {
        nextConfigPath: expect.stringMatching(
          /[/\\]\.storybook[/\\]next\.config\.ts$/,
        ),
      },
    });
    expect(storybookNextConfig).toMatchObject({
      typedRoutes: true,
    });
  });

  it("reports every malformed public variable", () => {
    expect(() =>
      validateBuildEnvironment({
        NEXT_PUBLIC_POSTHOG_HOST: "http://eu.i.posthog.com",
        NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "invalid-token",
        NEXT_PUBLIC_SANITY_DATASET: "Invalid Dataset",
        NEXT_PUBLIC_SANITY_PROJECT_ID: "sj3zsz66",
        NEXT_PUBLIC_WORLD_URL: "http://localhost:8001",
        VERCEL: "1",
      }),
    ).toThrow(
      [
        "Invalid build environment:",
        '- NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN must start with "phc_".',
        "- NEXT_PUBLIC_POSTHOG_HOST must be a valid HTTPS URL.",
        `- ${DATASET_MESSAGE}`,
        `- ${WORLD_URL_MESSAGE}`,
      ].join("\n"),
    );
  });

  it.each(["evil.example/x", "SJ3ZSZ66", "-sj3zsz66", "sj3zsz66-"])(
    "rejects the Sanity project ID %s",
    (projectId) => {
      expect(() =>
        validateBuildEnvironment({
          ...completeProtectedEnvironment,
          NEXT_PUBLIC_SANITY_PROJECT_ID: projectId,
        }),
      ).toThrow(
        [
          "Invalid build environment:",
          "- NEXT_PUBLIC_SANITY_PROJECT_ID must contain only lowercase letters, numbers, and hyphens.",
        ].join("\n"),
      );
    },
  );

  it.each(["staging_2", "prod-eu", "v2", "production-v2", "a".repeat(64)])(
    "accepts the Sanity dataset name %s",
    (dataset) => {
      expect(() =>
        validateBuildEnvironment({
          ...completeProtectedEnvironment,
          NEXT_PUBLIC_SANITY_DATASET: dataset,
        }),
      ).not.toThrow();
    },
  );

  it.each(["Staging", "-staging", "staging-", "a.b", "a".repeat(65)])(
    "rejects the dataset name %s, which Sanity does not allow",
    (dataset) => {
      expect(() =>
        validateBuildEnvironment({
          ...completeProtectedEnvironment,
          NEXT_PUBLIC_SANITY_DATASET: dataset,
        }),
      ).toThrow(
        ["Invalid build environment:", `- ${DATASET_MESSAGE}`].join("\n"),
      );
    },
  );

  it.each([
    ["the local world from .env.example", "http://localhost:8001"],
    ["HTTPS on loopback", "https://localhost"],
    [
      "a Railway private host the browser cannot reach",
      "https://world.railway.internal",
    ],
    ["a path", "https://ws.example.test/socket"],
    ["a WebSocket scheme", "wss://ws.example.test"],
  ])("rejects a world URL naming %s", (_case, worldUrl) => {
    expect(() =>
      validateBuildEnvironment({
        ...completeProtectedEnvironment,
        NEXT_PUBLIC_WORLD_URL: worldUrl,
      }),
    ).toThrow(
      ["Invalid build environment:", `- ${WORLD_URL_MESSAGE}`].join("\n"),
    );
  });

  it("reports a malformed host once", () => {
    expect(() =>
      validateBuildEnvironment({
        ...completeProtectedEnvironment,
        NEXT_PUBLIC_POSTHOG_HOST: "ftp://x",
      }),
    ).toThrow(
      new Error(
        [
          "Invalid build environment:",
          "- NEXT_PUBLIC_POSTHOG_HOST must be a valid HTTPS URL.",
        ].join("\n"),
      ),
    );
  });

  it("allows analytics configuration to be absent locally", () => {
    expect(() => validateBuildEnvironment({})).not.toThrow();
  });

  it.each([{ CI: "true" }, { VERCEL: "1" }])(
    "accepts a complete protected-build configuration",
    (buildEnvironment) => {
      expect(() =>
        validateBuildEnvironment({
          ...buildEnvironment,
          NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
          NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "phc_project",
          NEXT_PUBLIC_SANITY_DATASET: "staging",
          NEXT_PUBLIC_SANITY_PROJECT_ID: "sj3zsz66",
          NEXT_PUBLIC_WORLD_URL: "https://ws.example.test",
        }),
      ).not.toThrow();
    },
  );
});
