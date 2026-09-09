import { afterEach, describe, expect, it, vi } from "vitest";

import { validateBuildEnvironment } from "./validation";

describe("build environment validation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("rejects a protected build when required analytics variables are missing", async () => {
    vi.stubEnv("CI", "true");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");

    await expect(import("../../next.config")).rejects.toThrow(
      [
        "Invalid build environment:",
        "- NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is required.",
        "- NEXT_PUBLIC_POSTHOG_HOST is required.",
      ].join("\n"),
    );
  });

  it("reports every malformed analytics variable", () => {
    expect(() =>
      validateBuildEnvironment({
        NEXT_PUBLIC_POSTHOG_HOST: "http://eu.i.posthog.com",
        NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "invalid-token",
        VERCEL: "1",
      }),
    ).toThrow(
      [
        "Invalid build environment:",
        '- NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN must start with "phc_".',
        "- NEXT_PUBLIC_POSTHOG_HOST must be a valid HTTPS URL.",
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
        }),
      ).not.toThrow();
    },
  );
});
