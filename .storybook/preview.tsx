import "../app/globals.css";

import type { Preview } from "@storybook/nextjs-vite";

import { fontVariableClasses } from "@/shared/styles/fonts";

const preview: Preview = {
  decorators: [
    (Story) => (
      <div className={`${fontVariableClasses} font-sans`}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    a11y: {
      test: "error",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "padded",
    options: {
      storySort: {
        order: ["Foundations", "Primitives", "Features", "Campus"],
      },
    },
  },
  tags: ["autodocs"],
};

export default preview;
