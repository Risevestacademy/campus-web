import path from "node:path";
import { fileURLToPath } from "node:url";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { createLogger } from "vite";
import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// posthog-js ships sourcemaps that point at sibling @posthog packages; Vite
// refuses them. Inlining it for the real-SDK evals would print one per file.
const logger = createLogger();
const { warnOnce } = logger;
logger.warnOnce = (message, options) => {
  if (message.includes("posthog-js") && message.includes("outside its package"))
    return;
  warnOnce(message, options);
};

export default defineConfig({
  customLogger: logger,
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
          // The msw world in tests/fixtures/mock-world.ts; never a real host.
          env: { NEXT_PUBLIC_WORLD_URL: "https://ws.example.test" },
          include: ["**/*.test.{ts,tsx}"],
          // Inlined so vi.resetModules() loads a fresh PostHog singleton: the
          // analytics evals reload the real SDK against the same browser storage.
          server: { deps: { inline: ["posthog-js"] } },
          setupFiles: ["./tests/setup.ts"],
          testTimeout: 15_000,
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
            "@phosphor-icons/react/dist/ssr/Microphone",
            "@phosphor-icons/react/dist/ssr/MicrophoneSlash",
            "@phosphor-icons/react/dist/ssr/VideoCamera",
            "@phosphor-icons/react/dist/ssr/VideoCameraSlash",
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
            screenshotDirectory: "test-results/storybook",
            screenshotFailures: true,
          },
        },
      },
    ],
  },
});
