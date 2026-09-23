// @vitest-environment node

import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const componentFiles = [
  "components/ui/avatar.tsx",
  "components/ui/input.tsx",
  "components/ui/label.tsx",
  "components/ui/textarea.tsx",
];

describe("React effect import architecture", () => {
  it("allows the UI components to import React types without exposing useEffect", async () => {
    const eslint = new ESLint({ cwd: projectRoot });
    const results = await eslint.lintFiles(componentFiles);
    const violations = results.flatMap(({ filePath, messages }) =>
      messages
        .filter(({ ruleId }) => ruleId === "no-restricted-imports")
        .map(({ line, message }) => ({ filePath, line, message })),
    );

    expect(violations).toEqual([]);
  }, 15_000);
});
