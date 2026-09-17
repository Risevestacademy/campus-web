import path from "node:path";

import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  stories: [
    "../{design-system,features,shared}/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {
      nextConfigPath: path.resolve(import.meta.dirname, "next.config.ts"),
    },
  },
};

export default config;
