// @vitest-environment node

import { readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const SOURCE_ROOTS = [
  "app",
  "config",
  "core",
  "design-system",
  "features",
  "shared",
  "tests",
];

// kebab-case, or a Next.js routing folder: (group), [param], [...param],
// [[...param]], @slot, _private.
const FOLDER_NAME =
  /^(?:[a-z0-9]+(?:-[a-z0-9]+)*|\([a-z0-9-]+\)|\[{1,2}(?:\.{3})?[a-zA-Z0-9]+\]{1,2}|@[a-z0-9-]+|_[a-z0-9-]+)$/;

async function foldersUnder(root: string): Promise<string[]> {
  const entries = await readdir(path.join(PROJECT_ROOT, root), {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      path.relative(PROJECT_ROOT, path.join(entry.parentPath, entry.name)),
    );
}

describe("folder names", () => {
  it("names every source folder in kebab case or a Next.js routing convention", async () => {
    const folders = (await Promise.all(SOURCE_ROOTS.map(foldersUnder))).flat();

    expect(
      folders.filter((folder) => !FOLDER_NAME.test(path.basename(folder))),
    ).toEqual([]);
  });
});
