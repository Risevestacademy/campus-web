import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { Separator } from "./separator";

const meta = {
  title: "Primitives/Separator",
  component: Separator,
} satisfies Meta<typeof Separator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  render: () => (
    <div className="flex w-96 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="font-medium">Campus activity</p>
        <p className="text-foreground-muted text-sm">
          Recent updates from your learning community.
        </p>
      </div>
      <Separator aria-label="Content divider" />
      <div className="flex h-5 items-center gap-4">
        <span>Overview</span>
        <Separator aria-label="Navigation divider" orientation="vertical" />
        <span>Activity</span>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("separator", { name: "Content divider" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("separator", { name: "Navigation divider" }),
    ).toHaveAttribute("aria-orientation", "vertical");
  },
};
