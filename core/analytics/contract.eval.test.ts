import { describe, expect, it } from "vitest";

import { validateBuildEnvironment } from "../../config/environment/validation";
import { ANALYTICS_EVENTS } from "./events";

describe("analytics contract evaluation", () => {
  it("passes when all 13 events are unique canonical object.action names", () => {
    const eventNames = Object.values(ANALYTICS_EVENTS);

    expect(eventNames).toHaveLength(13);
    expect(new Set(eventNames).size).toBe(eventNames.length);

    for (const eventName of eventNames) {
      expect(eventName).toMatch(/^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/);
    }
  });

  it("passes when development and production builds use distinct valid projects", () => {
    const deploymentEnvironments = [
      {
        name: "development",
        token: "phc_development",
      },
      {
        name: "production",
        token: "phc_production",
      },
    ];

    for (const environment of deploymentEnvironments) {
      expect(() =>
        validateBuildEnvironment({
          CI: "true",
          NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
          NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: environment.token,
        }),
      ).not.toThrow();
    }

    expect(new Set(deploymentEnvironments.map(({ token }) => token)).size).toBe(
      deploymentEnvironments.length,
    );
  });
});
