// @vitest-environment node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import typescriptParser from "@typescript-eslint/parser";
import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import phosphorImportRestrictions from "@/config/phosphor-imports.json";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const phosphorPackageName = "@phosphor-icons/react";
const sourceDirectories = [
  "app",
  "core",
  "design-system",
  "features",
  "shared",
];
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
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
    "no-restricted-imports": ["error", phosphorImportRestrictions],
  },
} satisfies Linter.Config;

async function readSourceFiles(sourceDirectory: string) {
  const directoryPath = path.join(projectRoot, sourceDirectory);
  const entries = await readdir(directoryPath, {
    recursive: true,
    withFileTypes: true,
  });
  const filePaths = entries
    .filter(
      (entry) =>
        entry.isFile() && sourceExtensions.has(path.extname(entry.name)),
    )
    .map((entry) => path.join(entry.parentPath, entry.name));

  return Promise.all(
    filePaths.map(async (filePath) => ({
      filePath,
      source: await readFile(filePath, "utf8"),
    })),
  );
}

async function findPhosphorSources() {
  const sourceFiles = (
    await Promise.all(sourceDirectories.map(readSourceFiles))
  ).flat();

  return sourceFiles.filter(({ source }) =>
    source.includes(phosphorPackageName),
  );
}

describe("Phosphor import evaluation (required threshold: 0 violations)", () => {
  it("uses direct per-icon modules for every runtime import", async () => {
    const phosphorSources = await findPhosphorSources();
    const violations = phosphorSources.flatMap(({ filePath, source }) =>
      linter
        .verify(source, lintConfig, { filename: filePath })
        .filter(
          ({ fatal, ruleId }) =>
            fatal === true || ruleId === "no-restricted-imports",
        )
        .map(({ line, message }) => ({ filePath, line, message })),
    );

    expect(violations).toEqual([]);
  });
});
