import path from "node:path";
import { fileURLToPath } from "node:url";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["**/*.test.{ts,tsx}"],
          setupFiles: ["./tests/setup.ts"],
        },
      },
      {
        extends: true,
        optimizeDeps: {
          include: [
            "@base-ui/react/avatar",
            "@base-ui/react/button",
            "@base-ui/react/checkbox",
            "@base-ui/react/input",
            "@base-ui/react/merge-props",
            "@base-ui/react/separator",
            "@base-ui/react/switch",
            "@base-ui/react/use-render",
            "class-variance-authority",
            "cn",
          ],
        },
        plugins: [
          storybookTest({
            configDir: path.join(projectRoot, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            provider: playwright({}),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
