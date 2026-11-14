import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { Tabs, TabsList, TabsPanel, TabsTab } from "./tabs";

const meta = {
  title: "Primitives/Tabs",
  component: Tabs,
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Vertical: Story = {
  render: () => (
    <Tabs defaultValue="profile" orientation="vertical" className="w-md">
      <TabsList aria-label="Profile sections" className="w-40">
        <TabsTab value="profile">Profile</TabsTab>
        <TabsTab value="character">Character</TabsTab>
      </TabsList>
      <TabsPanel value="profile">Your name and bio.</TabsPanel>
      <TabsPanel value="character">How you look on the map.</TabsPanel>
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Your name and bio.")).toBeVisible();

    await userEvent.click(canvas.getByRole("tab", { name: "Character" }));

    await expect(canvas.getByText("How you look on the map.")).toBeVisible();
    await expect(
      canvas.getByRole("tab", { name: "Character" }),
    ).toHaveAttribute("aria-selected", "true");
  },
};
