import { MapTrifoldIcon } from "@phosphor-icons/react/dist/ssr/MapTrifold";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, screen, userEvent, within } from "storybook/test";

import { buttonVariants } from "./button";
import { Kbd } from "./kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

const meta = {
  title: "Primitives/Tooltip",
  component: Tooltip,
} satisfies Meta<typeof Tooltip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  render: () => (
    <TooltipProvider delay={0}>
      <div className="flex items-center gap-6">
        <Tooltip>
          <TooltipTrigger
            aria-label="Campus overview"
            className={buttonVariants({ variant: "ghost", size: "icon-lg" })}
          >
            <MapTrifoldIcon aria-hidden size={22} />
          </TooltipTrigger>
          <TooltipContent side="right">Campus overview</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            aria-label="Search participants"
            className={buttonVariants({ variant: "outline" })}
          >
            Search
          </TooltipTrigger>
          <TooltipContent>
            Search participants
            <Kbd>Ctrl F</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Campus overview" });

    await userEvent.hover(trigger);
    // Tooltip content renders in a portal, outside the story's canvas.
    await expect(await screen.findByText("Campus overview")).toBeVisible();

    await userEvent.unhover(trigger);
  },
};
