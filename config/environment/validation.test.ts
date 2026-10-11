import { afterEach, describe, expect, it, vi } from "vitest";

import { validateBuildEnvironment } from "./validation";

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

    await expect(import("../../next.config")).rejects.toThrow(
      [
        "Invalid build environment:",
        "- NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is required.",
        "- NEXT_PUBLIC_POSTHOG_HOST is required.",
        "- NEXT_PUBLIC_SANITY_PROJECT_ID is required.",
        "- NEXT_PUBLIC_SANITY_DATASET is required.",
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
        VERCEL: "1",
      }),
    ).toThrow(
      [
        "Invalid build environment:",
        '- NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN must start with "phc_".',
        "- NEXT_PUBLIC_POSTHOG_HOST must be a valid HTTPS URL.",
        "- NEXT_PUBLIC_SANITY_DATASET must contain only lowercase letters, numbers, underscores, and hyphens.",
      ].join("\n"),
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
        }),
      ).not.toThrow();
    },
  );
});
