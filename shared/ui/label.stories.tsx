import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "Primitives/Label",
  component: Label,
} satisfies Meta<typeof Label>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-2">
      <Label htmlFor="display-name">
        Display name
        <span aria-hidden>*</span>
      </Label>
      <Input id="display-name" required />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Display name"));
    await expect(canvas.getByLabelText(/display name/i)).toHaveFocus();
  },
};
