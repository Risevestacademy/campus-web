import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, within } from "storybook/test";

import { LogOutButton } from "./log-out-button";

const meta = {
  title: "Features/Auth/LogOutButton",
  component: LogOutButton,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof LogOutButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Log out" }),
    ).toBeEnabled();
  },
};

export const Destructive: Story = { args: { variant: "destructive" } };

export const Small: Story = { args: { size: "sm" } };
