import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { Label } from "./label";
import { Textarea } from "./textarea";

const meta = {
  title: "Primitives/Textarea",
  component: Textarea,
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" placeholder="Describe your campus" />
      </div>
      <Textarea
        aria-label="Disabled textarea"
        placeholder="Disabled"
        disabled
      />
      <Textarea
        aria-label="Invalid textarea"
        defaultValue="Invalid value"
        aria-invalid
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const textarea = within(canvasElement).getByLabelText("Description");
    await userEvent.type(textarea, "A collaborative learning space.");
    await expect(textarea).toHaveValue("A collaborative learning space.");
  },
};
