// @vitest-environment node

import type {
  ProjectDefinition,
  RailwayProgram,
  ServiceNode,
} from "railway/iac";
import { createRailwayContext, project } from "railway/iac";
import { describe, expect, it } from "vitest";

import stagingDefinition, {
  partial as stagingPartial,
} from "../../.railway/railway";
import productionDefinition, {
  partial as productionPartial,
} from "../../.railway/railway.production";

async function evaluateRailwayDefinition(
  definition: RailwayProgram,
): Promise<ProjectDefinition> {
  return definition(createRailwayContext(), project);
}

function findService(
  definition: ProjectDefinition,
  serviceName: string,
): ServiceNode {
  const resource = definition.resources
    ?.flat()
    .find(({ name }) => name === serviceName);

  if (resource?.type !== "service") {
    throw new Error(`Railway service not found: ${serviceName}`);
  }

  return resource;
}

describe("Railway IaC eval (required threshold: 5/5)", () => {
  it("owns only the two frontend services through one stable partial", async () => {
    const definitions = await Promise.all([
      evaluateRailwayDefinition(stagingDefinition),
      evaluateRailwayDefinition(productionDefinition),
    ]);

    expect([stagingPartial, productionPartial]).toEqual([
      "campus-frontends",
      "campus-frontends",
    ]);
    for (const definition of definitions) {
      expect(definition.name).toBe("campus-by-rise");
      expect(
        definition.resources?.flat().map(({ name, type }) => ({ name, type })),
      ).toEqual([
        { name: "campus-storybook", type: "service" },
        { name: "campus-web", type: "service" },
      ]);
    }
  });

  it("pins each environment to its required GitHub source", async () => {
    const staging = await evaluateRailwayDefinition(stagingDefinition);
    const production = await evaluateRailwayDefinition(productionDefinition);
    const stagingSource = {
      branch: "dev",
      checkSuites: true,
      repo: "Risevestacademy/campus-web",
      type: "github",
    };
    const productionSource = {
      branch: "main",
      checkSuites: true,
      repo: "Risevestacademy/campus-web",
      type: "github",
    };

    expect(findService(staging, "campus-storybook").source).toEqual(
      stagingSource,
    );
    expect(findService(staging, "campus-web").source).toEqual(stagingSource);
    expect(findService(production, "campus-storybook").source).toEqual(
      productionSource,
    );
    expect(findService(production, "campus-web").source).toEqual(
      productionSource,
    );
  });

  it("preserves exactly the required campus-web variables", async () => {
    const definitions = await Promise.all([
      evaluateRailwayDefinition(stagingDefinition),
      evaluateRailwayDefinition(productionDefinition),
    ]);

    for (const definition of definitions) {
      expect(findService(definition, "campus-web").variables).toEqual({
        API_BASE_URL: { type: "preserve" },
        NEXT_PUBLIC_POSTHOG_HOST: { type: "preserve" },
        NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: { type: "preserve" },
      });
    }
  });

  it("keeps application variables out of campus-storybook", async () => {
    const definitions = await Promise.all([
      evaluateRailwayDefinition(stagingDefinition),
      evaluateRailwayDefinition(productionDefinition),
    ]);

    for (const definition of definitions) {
      expect(findService(definition, "campus-storybook").variables).toEqual({
        RAILPACK_SPA_OUTPUT_DIR: {
          type: "literal",
          value: "storybook-static",
        },
      });
    }
  });

  it("renders the imported build, watch, health, and replica settings", async () => {
    const definitions = await Promise.all([
      evaluateRailwayDefinition(stagingDefinition),
      evaluateRailwayDefinition(productionDefinition),
    ]);
    const expectedStorybookBuild = {
      buildCommand: "pnpm storybook:build",
      buildEnvironment: "V3",
      builder: "RAILPACK",
      watchPatterns: [
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
      ],
    };
    const expectedStorybookDeploy = {
      healthcheckPath: "/",
      multiRegionConfig: {
        ams: { numReplicas: 1 },
      },
    };
    const expectedWebBuild = {
      buildEnvironment: "V3",
      builder: "RAILPACK",
      watchPatterns: [
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
      ],
    };
    const expectedWebDeploy = {
      multiRegionConfig: {
        ams: { numReplicas: 1 },
      },
    };

    for (const definition of definitions) {
      const storybook = findService(definition, "campus-storybook");
      const web = findService(definition, "campus-web");

      expect(storybook.build).toEqual(expectedStorybookBuild);
      expect(storybook.deploy).toEqual(expectedStorybookDeploy);
      expect(web.build).toEqual(expectedWebBuild);
      expect(web.deploy).toEqual(expectedWebDeploy);
    }
  });
});
