import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { Label } from "./label";
import { NativeSelect } from "./native-select";

const meta = {
  title: "Primitives/NativeSelect",
  component: NativeSelect,
} satisfies Meta<typeof NativeSelect>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="camera">Camera</Label>
        <NativeSelect id="camera" defaultValue="built-in">
          <option value="built-in">Built-in camera</option>
          <option value="usb">USB webcam</option>
        </NativeSelect>
      </div>
      <NativeSelect aria-label="Disabled select" disabled>
        <option>No cameras found</option>
      </NativeSelect>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const select = within(canvasElement).getByRole("combobox", {
      name: "Camera",
    });
    await userEvent.selectOptions(select, "usb");

    await expect(select).toHaveValue("usb");
  },
};
