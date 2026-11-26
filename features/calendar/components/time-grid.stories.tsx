import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import type { CalendarEvent } from "../schemas/calendar-events.schema";
import { daysOf, rangeOf } from "../services/calendar-window";
import { MonthGrid } from "./month-grid";
import { TimeGrid } from "./time-grid";

const NOW = new Date(2026, 8, 30, 9, 55);

const times = {
  allDay: false,
  status: "confirmed",
  response: "accepted",
} as const;

function campus(id: string, start: string, end: string): CalendarEvent {
  return {
    ...times,
    id,
    kind: "campus",
    title: `Class ${id}`,
    start,
    end,
    location: null,
    googleUrl: null,
    room: { code: "k3F9xQ2pLm", spaceName: "Pod A" },
  };
}

const EVENTS: CalendarEvent[] = [
  campus("a", "2026-09-30T10:00:00+01:00", "2026-09-30T11:30:00+01:00"),
  campus("b", "2026-09-30T10:30:00+01:00", "2026-09-30T12:00:00+01:00"),
  {
    ...times,
    id: "busy",
    kind: "busy",
    start: "2026-10-01T14:00:00+01:00",
    end: "2026-10-01T15:00:00+01:00",
  },
  {
    ...times,
    id: "holiday",
    kind: "busy",
    allDay: true,
    start: "2026-10-01",
    end: "2026-10-03",
  },
  {
    ...times,
    id: "late",
    kind: "busy",
    start: "2026-10-02T22:00:00+01:00",
    end: "2026-10-03T02:00:00+01:00",
  },
];

const meta = {
  title: "Features/Calendar/Grids",
  component: TimeGrid,
  decorators: [
    (Story) => (
      <div className="bg-background flex h-[560px] flex-col p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    days: daysOf(rangeOf("week", NOW)),
    events: EVENTS,
    now: NOW,
  },
} satisfies Meta<typeof TimeGrid>;

export default meta;

type Story = StoryObj<typeof meta>;

// Overlapping events share a column, an all-day event sits above the hours,
// and an event across midnight is drawn on both days.
export const Week: Story = {
  play: async ({ canvasElement }) => {
    const grid = within(canvasElement);

    await expect(grid.getByRole("button", { name: /^Class a/ })).toBeVisible();
    await expect(grid.getByRole("button", { name: /^Class b/ })).toBeVisible();
    await expect(grid.getAllByRole("button", { name: /^Busy/ })).toHaveLength(
      4,
    );
    await expect(grid.getByTestId("now-line")).toBeVisible();
  },
};

export const Day: Story = {
  args: { days: daysOf(rangeOf("day", NOW)) },
};

export const Month: Story = {
  render: () => (
    <MonthGrid
      days={daysOf(rangeOf("month", NOW))}
      anchor={NOW}
      events={EVENTS}
      now={NOW}
      onOpenDay={() => undefined}
    />
  ),
};
