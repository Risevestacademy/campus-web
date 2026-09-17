import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { FoundationsOverview } from "./overview";

const meta = {
  title: "Foundations/Overview",
  component: FoundationsOverview,
} satisfies Meta<typeof FoundationsOverview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FoundationStatus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("heading", {
        level: 1,
        name: "Design system foundations",
      }),
    ).toBeVisible();
    await expect(
      canvas.getByText(/awaiting an approved design source/i),
    ).toBeVisible();
  },
};
