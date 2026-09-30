import { DotsThreeVerticalIcon } from "@phosphor-icons/react/dist/ssr/DotsThreeVertical";
import { GearSixIcon } from "@phosphor-icons/react/dist/ssr/GearSix";
import { WarningIcon } from "@phosphor-icons/react/dist/ssr/Warning";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, screen, userEvent, within } from "storybook/test";

import { buttonVariants } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const meta = {
  title: "Primitives/DropdownMenu",
  component: DropdownMenu,
} satisfies Meta<typeof DropdownMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More"
        className={buttonVariants({ variant: "outline", size: "icon" })}
      >
        <DotsThreeVerticalIcon aria-hidden size={18} weight="bold" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>
          <WarningIcon aria-hidden size={16} />
          Report an issue
        </DropdownMenuItem>
        <DropdownMenuItem>
          <GearSixIcon aria-hidden size={16} />
          Settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "More" });

    await userEvent.click(trigger);

    // The menu content renders in a portal, outside the story's canvas.
    await expect(
      await screen.findByRole("menuitem", { name: "Settings" }),
    ).toBeVisible();
  },
};
