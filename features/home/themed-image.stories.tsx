import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import yourCohort from "@/assets/landing-page/your-cohort.svg";
import yourCohortDark from "@/assets/landing-page/your-cohort-dark.svg";

import { ThemedImage } from "./themed-image";

const meta = {
  title: "Home/ThemedImage",
  component: ThemedImage,
  args: {
    light: yourCohort,
    dark: yourCohortDark,
    alt: "Your cohort",
    width: 205,
    height: 141,
  },
} satisfies Meta<typeof ThemedImage>;

export default meta;

type Story = StoryObj<typeof meta>;

// Both are in the page and CSS shows one, so exactly one is accessible.
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getAllByRole("img", { name: "Your cohort" }),
    ).toHaveLength(1);
  },
};
