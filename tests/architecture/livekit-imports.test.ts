// @vitest-environment node

import typescriptParser from "@typescript-eslint/parser";
import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import livekitImportRestrictions from "@/config/livekit-imports.json";

const linter = new Linter();
const lintConfig = {
  languageOptions: {
    parser: typescriptParser,
    parserOptions: { sourceType: "module" },
  },
  rules: {
    "no-restricted-imports": ["error", livekitImportRestrictions],
  },
} satisfies Linter.Config;

function getRestrictedImportViolations(source: string) {
  return linter
    .verify(source, lintConfig)
    .filter(({ ruleId }) => ruleId === "no-restricted-imports");
}

// livekit-client is about 150 KB gzipped: only a dynamic import() keeps it
// out of the Join Gate's first load.
describe("livekit-client import architecture", () => {
  it.each([
    {
      name: "value imports",
      source:
        'import { ConnectionCheck } from "livekit-client";\nvoid ConnectionCheck;',
    },
    {
      name: "namespace imports",
      source: 'import * as Livekit from "livekit-client";\nvoid Livekit;',
    },
    {
      name: "subpath imports",
      source:
        'import { Room } from "livekit-client/dist/livekit-client.esm.mjs";\nvoid Room;',
    },
  ])("rejects $name", ({ source }) => {
    expect(getRestrictedImportViolations(source)).toHaveLength(1);
  });

  it.each([
    {
      name: "type-only imports",
      source:
        'import type { CheckInfo } from "livekit-client";\nexport type Info = CheckInfo;',
    },
    {
      name: "type-only namespace imports",
      source:
        'import type * as Livekit from "livekit-client";\nexport type Info = Livekit.CheckInfo;',
    },
    {
      name: "dynamic imports",
      source: 'export const load = () => import("livekit-client");',
    },
  ])("allows $name", ({ source }) => {
    expect(getRestrictedImportViolations(source)).toHaveLength(0);
  });
});
