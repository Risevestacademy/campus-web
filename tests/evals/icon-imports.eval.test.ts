// @vitest-environment node

import { fileURLToPath } from "node:url";

import typescriptParser from "@typescript-eslint/parser";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

import phosphorImportRestrictions from "@/config/phosphor-imports.json";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const sourceGlobs = [
  "app/**/*.{js,jsx,ts,tsx}",
  "core/**/*.{js,jsx,ts,tsx}",
  "design-system/**/*.{js,jsx,ts,tsx}",
  "features/**/*.{js,jsx,ts,tsx}",
  "shared/**/*.{js,jsx,ts,tsx}",
];

describe("Phosphor import evaluation (required threshold: 0 violations)", () => {
  it("uses direct per-icon modules for every runtime import", async () => {
    const eslint = new ESLint({
      cwd: projectRoot,
      errorOnUnmatchedPattern: false,
      ignore: false,
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ["**/*.{js,jsx,ts,tsx}"],
          languageOptions: {
            parser: typescriptParser,
            parserOptions: {
              ecmaFeatures: { jsx: true },
              sourceType: "module",
            },
          },
          rules: {
            "no-restricted-imports": ["error", phosphorImportRestrictions],
          },
        },
      ],
    });
    const results = await eslint.lintFiles(sourceGlobs);
    const violations = results.flatMap(({ filePath, messages }) =>
      messages
        .filter(
          ({ fatal, ruleId }) =>
            fatal === true || ruleId === "no-restricted-imports",
        )
        .map(({ line, message }) => ({ filePath, line, message })),
    );

    expect(violations).toEqual([]);
  });
});
