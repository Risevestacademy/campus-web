import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "Primitives/Input",
  component: Input,
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="campus-name">Campus name</Label>
        <Input id="campus-name" placeholder="Enter a campus name" />
      </div>
      <Input aria-label="Disabled input" placeholder="Disabled" disabled />
      <Input
        aria-label="Invalid input"
        defaultValue="Invalid value"
        aria-invalid
      />
    </div>
  ),
};
