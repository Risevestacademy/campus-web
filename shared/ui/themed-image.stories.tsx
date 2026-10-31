import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import yourCohort from "@/assets/landing-page/your-cohort.svg";
import yourCohortDark from "@/assets/landing-page/your-cohort-dark.svg";

import { ThemedImage } from "./themed-image";

const meta = {
  title: "Primitives/ThemedImage",
  component: ThemedImage,
  args: { light: yourCohort, alt: "Your cohort", width: 205, height: 141 },
} satisfies Meta<typeof ThemedImage>;

export default meta;

type Story = StoryObj<typeof meta>;

// A variant for each theme: both are in the page, CSS shows one.
export const WithDarkVariant: Story = {
  args: { dark: yourCohortDark },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getAllByRole("img", { hidden: true }),
    ).toHaveLength(2);
  },
};

// Without one, the light image serves both themes and appears once.
export const LightOnly: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("img", { name: "Your cohort" }),
    ).toBeVisible();
  },
};
