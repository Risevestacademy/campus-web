import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { cn } from "cn";
import { fn } from "storybook/test";

import { avatarToneOf } from "@/shared/lib/avatar";
import { Separator } from "@/shared/ui/separator";

import { PresenceMenuTrigger } from "./presence-menu-trigger";
import { StatusTray } from "./status-tray";

const meta = {
  title: "Features/Campus/StatusTray",
  component: StatusTray,
  decorators: [
    (Story, { args, parameters }) => (
      <div
        data-theme={parameters.dark ? "dark" : undefined}
        className="bg-background flex justify-center"
      >
        <div className="bg-cobalt-500/10 flex w-full justify-center p-6">
          <div className="bg-background text-foreground flex w-fit flex-col rounded-[1.25rem]">
            <Story />
            <Separator className="mx-3.5 w-auto data-horizontal:w-auto" />
            <div
              className={cn(
                "flex items-center gap-1.5 py-1.5 pr-1.75 pl-2",
                parameters.narrow ? "w-56" : "w-96",
              )}
            >
              <PresenceMenuTrigger
                aria-expanded
                avatarClassName={avatarToneOf("ada")}
                initial="A"
                status={args.status}
                timeLeft={args.timeLeft}
              />
            </div>
          </div>
        </div>
      </div>
    ),
  ],
  args: {
    canChoose: true,
    durationId: null,
    onDurationChange: fn(),
    onStatusChange: fn(),
    refusals: {},
    status: "available",
    timeLeft: null,
  },
} satisfies Meta<typeof StatusTray>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Available: Story = {};

export const BusyForAWhile: Story = {
  args: { status: "busy", durationId: "1h", timeLeft: "52 min" },
};

export const AwayUntilChanged: Story = {
  args: { status: "away" },
};

export const TodayTooLong: Story = {
  args: {
    status: "busy",
    refusals: {
      today: "A status lasts 12 hours at most, and today has longer left.",
    },
  },
};

export const Reconnecting: Story = {
  args: { canChoose: false, status: "busy" },
};

export const Dark: Story = {
  args: { status: "away", durationId: "2h", timeLeft: "1 h 40 min" },
  parameters: { dark: true },
};

export const AdminDock: Story = {
  args: {
    status: "busy",
    durationId: "30m",
    timeLeft: "24 min",
    stacked: true,
  },
  parameters: { narrow: true },
};
