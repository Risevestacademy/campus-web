import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import eslintPluginSimpleImportSort from "eslint-plugin-simple-import-sort";
import unicornPlugin from "eslint-plugin-unicorn";
import unusedImportsPlugin from "eslint-plugin-unused-imports";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{js,ts,jsx,tsx,mjs,cjs}"],
    plugins: {
      "simple-import-sort": eslintPluginSimpleImportSort,
      unicorn: unicornPlugin,
      "unused-imports": unusedImportsPlugin,
    },
    rules: {
      "@next/next/no-img-element": "warn",
      "unicorn/no-array-callback-reference": "off",
      "unicorn/no-array-for-each": "off",
      "unicorn/no-array-reduce": "off",
      "unicorn/no-null": "off",
      "unicorn/prevent-abbreviations": [
        "error",
        {
          checkFilenames: false,
          allowList: { e2e: true },
          replacements: {
            props: false,
            ref: false,
            params: false,
          },
          ignore: ["ColumnDef"],
        },
      ],
      "unicorn/prefer-node-protocol": "off",
      "unicorn/filename-case": "off",
      "unicorn/no-array-method-this-argument": "off",
      "unicorn/prefer-spread": "off",
      "simple-import-sort/exports": "error",
      "simple-import-sort/imports": "error",
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    ".vercel/**",
    "coverage/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
