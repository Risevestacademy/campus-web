// @vitest-environment node

import path from "node:path";
import { fileURLToPath } from "node:url";

import typescriptParser from "@typescript-eslint/parser";
import { ESLint } from "eslint";
import boundaries from "eslint-plugin-boundaries";
import { describe, expect, it } from "vitest";

import architectureBoundaries from "../../config/architecture-boundaries.json";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const fixtureRoot = path.join(projectRoot, "tests/fixtures/architecture");

const eslint = new ESLint({
  cwd: fixtureRoot,
  ignore: false,
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ["**/*.ts"],
      languageOptions: {
        parser: typescriptParser,
      },
      plugins: {
        boundaries,
      },
      settings: {
        "boundaries/root-path": fixtureRoot,
        "boundaries/elements": architectureBoundaries.elements,
        "import/resolver": {
          typescript: {
            project: path.join(projectRoot, "tsconfig.json"),
          },
        },
      },
      rules: {
        "boundaries/dependencies": [
          "error",
          architectureBoundaries.dependencyRule,
        ],
      },
    },
  ],
});

async function getBoundaryViolations(filePath: string) {
  const results = await eslint.lintFiles(filePath);

  return results.flatMap(({ messages }) =>
    messages.filter(({ ruleId }) => ruleId === "boundaries/dependencies"),
  );
}

describe("architecture import boundaries", () => {
  it.each([
    "shared/imports-app.ts",
    "core/imports-app.ts",
    "features/auth/imports-app.ts",
    "features/auth/imports-profile.ts",
    "app/imports-feature-internal.ts",
  ])("rejects the dependency in %s", async (filePath) => {
    await expect(getBoundaryViolations(filePath)).resolves.toHaveLength(1);
  });

  it.each([
    "app/imports-shared.ts",
    "core/imports-shared.ts",
    "features/auth/imports-shared.ts",
    "app/imports-feature-public.ts",
    "features/profile/imports-own-internal.ts",
  ])("allows the dependency in %s", async (filePath) => {
    await expect(getBoundaryViolations(filePath)).resolves.toHaveLength(0);
  });
});
