import path from "node:path";

import typescriptParser from "@typescript-eslint/parser";
import { ESLint } from "eslint";
import boundaries from "eslint-plugin-boundaries";

import architectureBoundaries from "../../config/architecture-boundaries.json" with { type: "json" };

export const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

// Only the boundaries rule and what it needs to resolve imports: the full
// project config took seconds per lint and timed the evals out.
const eslint = new ESLint({
  cwd: PROJECT_ROOT,
  overrideConfigFile: true,
  overrideConfig: {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: typescriptParser },
    plugins: { boundaries },
    settings: {
      "boundaries/root-path": PROJECT_ROOT,
      "boundaries/elements": architectureBoundaries.elements,
      "boundaries/files": architectureBoundaries.files,
      "import/resolver": { typescript: { project: "./tsconfig.json" } },
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        architectureBoundaries.dependencyRule,
      ],
    },
  },
});

export async function boundaryErrors(
  source: string,
  filePath: string,
): Promise<string[]> {
  const [result] = await eslint.lintText(source, { filePath });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === "boundaries/dependencies")
    .map((message) => message.message);
}
