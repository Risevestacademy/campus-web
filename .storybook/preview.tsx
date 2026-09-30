import "../app/globals.css";

import type { Preview } from "@storybook/nextjs-vite";

import { fontVariableClasses } from "@/shared/styles/fonts";

globalThis.document?.documentElement.classList.add(
  ...fontVariableClasses.split(/\s+/),
  "font-sans",
  "antialiased",
);

const preview: Preview = {
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
