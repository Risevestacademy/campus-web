import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { Toggle } from "./toggle";

const meta = {
  title: "Primitives/Toggle",
  component: Toggle,
  args: {
    children: "Available",
  },
} satisfies Meta<typeof Toggle>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Variants</p>
        <div className="flex items-center gap-3">
          <Toggle variant="default">Default</Toggle>
          <Toggle variant="outline">Outline</Toggle>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Sizes</p>
        <div className="flex items-center gap-3">
          <Toggle size="sm">Small</Toggle>
          <Toggle size="default">Default</Toggle>
          <Toggle size="lg">Large</Toggle>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("button", { name: "Small" });

    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(toggle);

    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  },
};
