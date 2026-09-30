import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { Kbd, KbdGroup } from "./kbd";

const meta = {
  title: "Primitives/Kbd",
  component: Kbd,
} satisfies Meta<typeof Kbd>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-sm">
        Search participants
        <Kbd>Ctrl F</Kbd>
      </p>
      <p className="flex items-center gap-2 text-sm">
        Open command menu
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Ctrl F")).toBeVisible();
    await expect(canvas.getByText("K")).toBeVisible();
  },
};
