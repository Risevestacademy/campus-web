import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const FEATURES_DIR = join(process.cwd(), "features");
const REQUIRED_HEADINGS = [
  "## Interface",
  "## Modules",
  "## Contributing",
  "## Tests",
];
const SELF_EXPLANATORY = new Set(["index.ts", "README.md"]);

const features = readdirSync(FEATURES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

function readmeOf(feature: string): string {
  const path = join(FEATURES_DIR, feature, "README.md");
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function headingsOf(readme: string): string[] {
  return readme.split("\n").filter((line) => /^## /.test(line));
}

function moduleNamesOf(feature: string): string[] {
  return readdirSync(join(FEATURES_DIR, feature), { withFileTypes: true })
    .filter(
      (entry) =>
        !SELF_EXPLANATORY.has(entry.name) && !/\.test\./.test(entry.name),
    )
    .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));
}

describe.each(features)("features/%s README", (feature) => {
  const readme = readmeOf(feature);

  it("follows the contribution template", () => {
    expect(headingsOf(readme)).toEqual(REQUIRED_HEADINGS);
  });

  it("names every top-level module", () => {
    const unnamed = moduleNamesOf(feature).filter(
      (name) => !readme.includes(name),
    );
    expect(unnamed).toEqual([]);
  });
});
