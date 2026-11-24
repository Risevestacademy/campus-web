import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import type { CalendarEvent } from "../schemas/calendar-events.schema";
import { CalendarEventBlock } from "./calendar-event-block";

const campus: CalendarEvent = {
  id: "e-1",
  kind: "campus",
  title: "Design review",
  start: "2026-09-30T10:00:00+01:00",
  end: "2026-09-30T11:00:00+01:00",
  allDay: false,
  status: "confirmed",
  response: "accepted",
  location: "Room 2",
  googleUrl: "https://www.google.com/calendar/event?eid=abc",
  room: { code: "k3F9xQ2pLm", spaceName: "Pod A" },
};

const meta = {
  title: "Features/Calendar/CalendarEventBlock",
  component: CalendarEventBlock,
  args: { event: campus, now: new Date(2026, 8, 30, 8, 0) },
  decorators: [
    (Story) => (
      <div className="bg-background w-64 p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CalendarEventBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CampusEvent: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: /^Design review/ }),
    ).toBeVisible();
  },
};

// LIVE is written out, and Join is a link to the room.
export const Live: Story = {
  args: { now: new Date(2026, 8, 30, 9, 55) },
  play: async ({ canvasElement }) => {
    const block = within(canvasElement);

    await expect(block.getByText(/LIVE/)).toBeVisible();
    await expect(block.getByRole("link", { name: /^Join/ })).toHaveAttribute(
      "href",
      "/join/k3F9xQ2pLm",
    );
  },
};

export const Tentative: Story = {
  args: { event: { ...campus, status: "tentative" } },
};

export const Declined: Story = {
  args: { event: { ...campus, response: "declined" } },
};

export const Busy: Story = {
  args: {
    event: {
      id: "b-1",
      kind: "busy",
      start: "2026-09-30T13:00:00+01:00",
      end: "2026-09-30T14:00:00+01:00",
      allDay: false,
      status: "confirmed",
      response: null,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: /^Busy/ }),
    ).toBeVisible();
  },
};

export const Compact: Story = { args: { compact: true } };
