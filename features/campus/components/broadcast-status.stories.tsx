import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BroadcastStatusView } from "./broadcast-status";

const meta = {
  title: "Features/Campus/BroadcastStatus",
  component: BroadcastStatusView,
  decorators: [
    (Story) => (
      <div className="bg-cobalt-500/10 flex justify-center p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BroadcastStatusView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OneAdmin: Story = {
  args: { speakers: ["Ada Lovelace"] },
};

export const SeveralAdmins: Story = {
  args: { speakers: ["Ada Lovelace", "Grace Hopper", "An admin"] },
};
