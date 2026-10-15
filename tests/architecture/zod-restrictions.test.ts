// @vitest-environment node

import typescriptParser from "@typescript-eslint/parser";
import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import zodRestrictions from "@/config/zod-restrictions.json";

const linter = new Linter();
const lintConfig = {
  languageOptions: {
    parser: typescriptParser,
    parserOptions: { sourceType: "module" },
  },
  rules: {
    "no-restricted-syntax": ["error", ...zodRestrictions],
  },
} satisfies Linter.Config;

function getRestrictedSyntaxViolations(source: string) {
  return linter
    .verify(source, lintConfig)
    .filter(({ ruleId }) => ruleId === "no-restricted-syntax");
}

describe("Zod schema restrictions", () => {
  it.each([
    ["z.looseObject", "z.looseObject({ id: z.string() });"],
    ["z.strictObject", "z.strictObject({ id: z.string() });"],
    ["looseObject imported by name", 'import { looseObject } from "zod";'],
    ["strictObject imported by name", 'import { strictObject } from "zod";'],
    [".passthrough()", "z.object({}).passthrough();"],
    [".loose()", "z.object({}).loose();"],
    [".loose() on a schema variable", "base.loose();"],
    [".catchall()", "base.catchall(z.string());"],
    [".strict()", "z.object({}).strict();"],
    [".merge()", "z.object({}).merge(other);"],
    [
      "reportInput in a parse",
      "schema.safeParse(value, { reportInput: true });",
    ],
    ["reportInput in z.config", "z.config({ reportInput: true });"],
    ["a quoted reportInput", 'z.config({ "reportInput": true });'],
  ])("rejects %s", (_, source) => {
    expect(getRestrictedSyntaxViolations(source)).toHaveLength(1);
  });

  it.each([
    ["z.object", "z.object({ id: z.string() }).safeParse(body);"],
    [".extend()", "base.extend({ id: z.string() });"],
    ["the zod namespace import", 'import { z } from "zod";'],
    ["a non-Zod merge", "lodash.merge(a, b);"],
    ["a non-Zod strict", "assert.strict(actual, expected);"],
    [
      "a strict-sounding name",
      "const strictMode = isStrict(); void strictMode;",
    ],
  ])("allows %s", (_, source) => {
    expect(getRestrictedSyntaxViolations(source)).toHaveLength(0);
  });
});
