import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import boundaries from "eslint-plugin-boundaries";
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
      "@typescript-eslint/no-explicit-any": "error",
      "@next/next/no-img-element": "warn",
      "no-console": ["warn", { allow: ["error", "warn"] }],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              importNames: ["useEffect"],
              message:
                "Components must derive state, use event handlers, or use a focused reusable hook instead of importing useEffect directly.",
            },
          ],
        },
      ],
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
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    files: [
      "app/**/*.{js,jsx,ts,tsx}",
      "core/**/*.{js,jsx,ts,tsx}",
      "features/**/*.{js,jsx,ts,tsx}",
      "shared/**/*.{js,jsx,ts,tsx}",
    ],
    plugins: {
      boundaries,
    },
    settings: {
      "boundaries/root-path": import.meta.dirname,
      "boundaries/elements": [
        {
          type: "feature",
          pattern: "features/*",
          capture: ["featureName"],
          partialMatch: false,
        },
        {
          type: "app",
          pattern: "app",
          partialMatch: false,
        },
        {
          type: "core",
          pattern: "core",
          partialMatch: false,
        },
        {
          type: "shared",
          pattern: "shared",
          partialMatch: false,
        },
      ],
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            {
              from: { element: { type: "app" } },
              allow: {
                to: {
                  element: { type: ["core", "shared"] },
                },
              },
            },
            {
              from: { element: { type: "app" } },
              allow: {
                to: {
                  element: {
                    type: "feature",
                    fileInternalPath: "index.{ts,tsx}",
                  },
                },
              },
            },
            {
              from: { element: { type: "feature" } },
              allow: {
                to: {
                  element: { type: ["core", "shared"] },
                },
              },
            },
            {
              from: { element: { type: "core" } },
              allow: {
                to: {
                  element: { type: "shared" },
                },
              },
            },
          ],
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
    "playwright-report/**",
    "test-results/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
