// @vitest-environment node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import typescriptParser from "@typescript-eslint/parser";
import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import reactImportRestrictions from "@/config/react-imports.json";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const componentFiles = [
  "shared/ui/avatar.tsx",
  "shared/ui/input.tsx",
  "shared/ui/label.tsx",
  "shared/ui/textarea.tsx",
];

const linter = new Linter();
const lintConfig = {
  languageOptions: {
    parser: typescriptParser,
    parserOptions: {
      ecmaFeatures: { jsx: true },
      sourceType: "module",
    },
  },
  rules: {
    "no-restricted-imports": ["error", reactImportRestrictions],
  },
} satisfies Linter.Config;

async function getRestrictedImportViolations() {
  const violationsByFile = await Promise.all(
    componentFiles.map(async (filePath) => {
      const source = await readFile(path.join(projectRoot, filePath), "utf8");

      return linter
        .verify(source, lintConfig)
        .filter(({ ruleId }) => ruleId === "no-restricted-imports")
        .map(({ line, message }) => ({ filePath, line, message }));
    }),
  );

  return violationsByFile.flat();
}

describe("React effect import architecture", () => {
  it("allows the UI components to import React types without exposing useEffect", async () => {
    await expect(getRestrictedImportViolations()).resolves.toEqual([]);
  });
});
