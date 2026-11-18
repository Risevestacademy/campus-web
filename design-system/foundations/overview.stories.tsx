import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FoundationsOverview } from "./overview";

const meta = {
  title: "Foundations/Overview",
  component: FoundationsOverview,
} satisfies Meta<typeof FoundationsOverview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FoundationStatus: Story = {};
