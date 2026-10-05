import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const meta = {
  title: "Primitives/DropdownMenu",
  component: DropdownMenu,
} satisfies Meta<typeof DropdownMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline">Open actions</Button>}
      />
      <DropdownMenuContent aria-label="Campus actions">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Profile</DropdownMenuLabel>
          <DropdownMenuItem>Edit profile</DropdownMenuItem>
          <DropdownMenuItem>View activity</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive">
            Leave campus
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Open actions" });

    await userEvent.click(trigger);

    const page = within(canvasElement.ownerDocument.body);
    const menu = await page.findByRole("menu");

    await waitFor(() => expect(menu).toBeVisible());
    await expect(window.getComputedStyle(menu).fontFamily).toBe(
      window.getComputedStyle(trigger).fontFamily,
    );
  },
};
