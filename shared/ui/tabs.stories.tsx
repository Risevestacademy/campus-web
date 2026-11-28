import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsPillList,
  TabsPillTab,
  TabsTab,
} from "./tabs";

const meta = {
  title: "Primitives/Tabs",
  component: Tabs,
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof meta>;

// As in the profile dialog: the list sits straight on the dialog's surface.
export const Vertical: Story = {
  render: () => (
    <Tabs
      defaultValue="profile"
      orientation="vertical"
      className="bg-popover w-md rounded-xl p-3"
    >
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

// As in Settings: the list sits in a tinted sidebar beside the panel.
export const InSidebar: Story = {
  render: () => (
    <Tabs
      defaultValue="audio"
      orientation="vertical"
      className="bg-popover w-md gap-0 overflow-hidden rounded-xl"
    >
      <div className="bg-surface-elevated w-44 p-3">
        <TabsList aria-label="Settings sections">
          <TabsTab value="audio">Audio &amp; video</TabsTab>
          <TabsTab value="appearance">Appearance</TabsTab>
        </TabsList>
      </div>
      <TabsPanel value="audio" className="p-4">
        Devices
      </TabsPanel>
      <TabsPanel value="appearance" className="p-4">
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

// As in the chat panel's header: pills in a rounded list, with a count beside
// a name.
export const Pills: Story = {
  render: () => (
    <Tabs
      defaultValue="chat"
      className="bg-shell-panel border-shell-line w-80 gap-0 rounded-xl border p-3"
    >
      <TabsPillList aria-label="Chat sections">
        <TabsPillTab value="chat">Chat</TabsPillTab>
        <TabsPillTab value="people" count={3}>
          People
        </TabsPillTab>
        <TabsPillTab value="resources" count={0}>
          Resources
        </TabsPillTab>
      </TabsPillList>
      <TabsPanel value="chat" className="pt-3">
        The conversation.
      </TabsPanel>
      <TabsPanel value="people" className="pt-3">
        Who is here.
      </TabsPanel>
      <TabsPanel value="resources" className="pt-3">
        Files sent in the meeting.
      </TabsPanel>
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("tab", { name: "Chat" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await userEvent.click(canvas.getByRole("tab", { name: /People/ }));

    await expect(canvas.getByText("Who is here.")).toBeVisible();
  },
};
