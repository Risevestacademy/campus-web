import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible";

const meta = {
  title: "Primitives/Collapsible",
  component: Collapsible,
} satisfies Meta<typeof Collapsible>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  render: () => (
    <Collapsible className="w-64">
      <CollapsibleTrigger className="group/offline flex w-full items-center gap-2 text-sm font-medium">
        <CaretDownIcon
          aria-hidden
          size={14}
          className="-rotate-90 transition-transform group-data-panel-open/offline:rotate-0"
        />
        Offline
        <span className="text-muted-foreground">7</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="text-muted-foreground pt-2 pl-5 text-sm">
        Offline participants will show up here.
      </CollapsibleContent>
    </Collapsible>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Offline 7" });

    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(trigger);

    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(
      await canvas.findByText("Offline participants will show up here."),
    ).toBeVisible();
  },
};
