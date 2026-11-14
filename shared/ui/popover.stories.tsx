import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "./popover";

const meta = {
  title: "Primitives/Popover",
  component: Popover,
} satisfies Meta<typeof Popover>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline">Your account</Button>}
      />
      <PopoverContent side="right" align="start" className="w-72">
        <PopoverTitle>Ada Lovelace</PopoverTitle>
        <PopoverDescription>Backend · Cohort 2026</PopoverDescription>
      </PopoverContent>
    </Popover>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Your account" }));

    const page = within(canvasElement.ownerDocument.body);
    const popover = await page.findByRole("dialog", { name: "Ada Lovelace" });
    await waitFor(() => expect(popover).toBeVisible());

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
  },
};
