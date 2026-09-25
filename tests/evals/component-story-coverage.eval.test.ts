// @vitest-environment node

import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const uiDirectory = fileURLToPath(new URL("../../shared/ui/", import.meta.url));

describe("Component story coverage (required threshold: 0 missing stories)", () => {
  it("colocates a Storybook story with every flat reusable primitive", async () => {
    const entries = await readdir(uiDirectory, { withFileTypes: true });
    const componentNames = entries
      .filter(
        (entry) => entry.isFile() && /^[a-z][a-z0-9-]*\.tsx$/.test(entry.name),
      )
      .map(({ name }) => name.replace(/\.tsx$/, ""))
      .sort();
    const storyNames = new Set(
      entries
        .filter(
          (entry) => entry.isFile() && entry.name.endsWith(".stories.tsx"),
        )
        .map(({ name }) => name.replace(/\.stories\.tsx$/, "")),
    );
    const missingStories = componentNames.filter(
      (componentName) => !storyNames.has(componentName),
    );

    expect(missingStories).toEqual([]);
  });
});
