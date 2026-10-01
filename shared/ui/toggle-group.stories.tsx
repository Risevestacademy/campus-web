import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

const meta = {
  title: "Primitives/ToggleGroup",
  component: ToggleGroup,
} satisfies Meta<typeof ToggleGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">
          Single select (participant filter)
        </p>
        <ToggleGroup aria-label="Participant filter" defaultValue={["all"]}>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="available">Available</ToggleGroupItem>
          <ToggleGroupItem value="in-room">In a room</ToggleGroupItem>
          <ToggleGroupItem value="busy">Busy</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Outline variant</p>
        <ToggleGroup variant="outline" defaultValue={["available"]}>
          <ToggleGroupItem value="available">Available</ToggleGroupItem>
          <ToggleGroupItem value="busy">Busy</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const filterGroup = within(
      within(canvasElement).getByRole("group", { name: "Participant filter" }),
    );
    const availableButton = filterGroup.getByRole("button", {
      name: "Available",
    });

    await expect(availableButton).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(availableButton);

    await expect(availableButton).toHaveAttribute("aria-pressed", "true");
    await expect(
      filterGroup.getByRole("button", { name: "All" }),
    ).toHaveAttribute("aria-pressed", "false");
  },
};
