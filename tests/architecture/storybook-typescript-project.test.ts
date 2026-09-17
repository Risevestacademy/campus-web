// @vitest-environment node

import path from "node:path";
import { fileURLToPath } from "node:url";

import typescript from "typescript";
import { describe, expect, it } from "vitest";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const storybookConfigurationFiles = [
  ".storybook/main.ts",
  ".storybook/preview.tsx",
];

describe("Storybook TypeScript project coverage", () => {
  it("includes Storybook configuration files", () => {
    const configurationPath = path.join(projectRoot, "tsconfig.json");
    const configuration = typescript.readConfigFile(
      configurationPath,
      typescript.sys.readFile,
    );

    expect(configuration.error).toBeUndefined();

    const parsedConfiguration = typescript.parseJsonConfigFileContent(
      configuration.config,
      typescript.sys,
      projectRoot,
    );
    const expectedFiles = storybookConfigurationFiles.map((filePath) =>
      path.join(projectRoot, filePath),
    );

    expect(parsedConfiguration.errors).toEqual([]);
    expect(parsedConfiguration.fileNames).toEqual(
      expect.arrayContaining(expectedFiles),
    );
  });
});
