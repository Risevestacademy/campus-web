// @vitest-environment node

import typescriptParser from "@typescript-eslint/parser";
import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import phosphorImportRestrictions from "@/config/phosphor-imports.json";

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

function getRestrictedImportViolations(source: string) {
  return linter
    .verify(source, lintConfig)
    .filter(({ ruleId }) => ruleId === "no-restricted-imports");
}

describe("Phosphor import architecture", () => {
  it.each([
    {
      name: "package-root imports",
      source:
        'import { MoonIcon } from "@phosphor-icons/react";\nvoid MoonIcon;',
    },
    {
      name: "namespace imports",
      source:
        'import * as PhosphorIcons from "@phosphor-icons/react";\nvoid PhosphorIcons;',
    },
    {
      name: "shorthand per-icon imports",
      source:
        'import { MoonIcon } from "@phosphor-icons/react/Moon";\nvoid MoonIcon;',
    },
    {
      name: "aggregate SSR imports",
      source:
        'import { MoonIcon } from "@phosphor-icons/react/ssr";\nvoid MoonIcon;',
    },
    {
      name: "direct CSR imports",
      source:
        'import { MoonIcon } from "@phosphor-icons/react/dist/csr/Moon";\nvoid MoonIcon;',
    },
    {
      name: "non-root type imports",
      source:
        'import type { IconProps } from "@phosphor-icons/react/ssr";\nexport type ExampleIconProps = IconProps;',
    },
  ])("rejects $name", ({ source }) => {
    expect(getRestrictedImportViolations(source)).toHaveLength(1);
  });

  it.each([
    {
      name: "direct SSR imports",
      source:
        'import { MoonIcon } from "@phosphor-icons/react/dist/ssr/Moon";\nvoid MoonIcon;',
    },
    {
      name: "root type-only imports",
      source:
        'import type { IconProps } from "@phosphor-icons/react";\nexport type ExampleIconProps = IconProps;',
    },
  ])("allows $name", ({ source }) => {
    expect(getRestrictedImportViolations(source)).toHaveLength(0);
  });
});
