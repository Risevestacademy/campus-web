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
    <Tabs
      defaultValue="audio"
      orientation="vertical"
      className="bg-surface-elevated w-96 rounded-xl p-3"
    >
      <TabsList className="w-40" aria-label="Sections">
        <TabsTab value="audio">Audio &amp; video</TabsTab>
        <TabsTab value="appearance">Appearance</TabsTab>
      </TabsList>
      <TabsPanel value="audio" className="p-2">
        Devices
      </TabsPanel>
      <TabsPanel value="appearance" className="p-2">
        Theme
      </TabsPanel>
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: "Appearance" }));

    await expect(await canvas.findByText("Theme")).toBeVisible();
  },
};
