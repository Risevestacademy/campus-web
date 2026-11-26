import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { CalendarConnectCard } from "./calendar-connect-card";

const meta = {
  title: "Features/Calendar/CalendarConnectCard",
  component: CalendarConnectCard,
  decorators: [
    (Story) => (
      <div className="bg-background flex justify-center p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CalendarConnectCard>;

export default meta;

type Story = StoryObj<typeof meta>;

// What the member sees before connecting: it promises only that campus reads.
export const NotConnected: Story = {
  play: async ({ canvasElement }) => {
    const card = within(canvasElement);

    await expect(
      card.getByRole("heading", { name: "Connect Google Calendar" }),
    ).toBeVisible();
    await expect(
      card.getByText(/never creates or changes an event/),
    ).toBeVisible();
    await expect(
      card.getByRole("link", { name: "Connect Google Calendar" }),
    ).toHaveAttribute("href", "/api/v1/calendar/connect");
  },
};
