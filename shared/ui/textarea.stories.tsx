import type { Meta, StoryObj } from "@storybook/nextjs-vite";

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
};
