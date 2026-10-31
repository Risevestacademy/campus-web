import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { presenceFor } from "@/core/presence";
import type { Avatar } from "@/core/realtime";

import { PersonStatus } from "./person-status";

const USER_ID = "user-1";

function playerWith(status: Avatar["status"]): Avatar {
  return {
    userId: USER_ID,
    x: 0,
    y: 0,
    facing: "down",
    displayName: "Ada",
    spriteKey: null,
    status,
    spaceKey: "_default",
  };
}

// Each story has a cohort of its own: the presence registry keeps one store
// per cohort for the whole page.
function connected(cohortId: string, players: Avatar[]) {
  return () => {
    const presence = presenceFor(cohortId).getState();
    presence.apply({
      type: "snapshot",
      map: { id: "campus", version: "v1", width: 10, height: 10 },
      players,
      spaces: [],
    });
    return () => presence.clear();
  };
}

const meta = {
  title: "Features/Admin/People/PersonStatus",
  component: PersonStatus,
  args: { cohortId: "story-status", userId: USER_ID },
} satisfies Meta<typeof PersonStatus>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Available: Story = {
  args: { cohortId: "story-available" },
  beforeEach: connected("story-available", [playerWith("available")]),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Available")).toBeVisible();
  },
};

export const Busy: Story = {
  args: { cohortId: "story-busy" },
  beforeEach: connected("story-busy", [playerWith("busy")]),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Busy")).toBeVisible();
  },
};

export const Away: Story = {
  args: { cohortId: "story-away" },
  beforeEach: connected("story-away", [playerWith("away")]),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Away")).toBeVisible();
  },
};

// Connected to the world, but this person is not in it.
export const Offline: Story = {
  args: { cohortId: "story-offline" },
  beforeEach: connected("story-offline", []),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Offline")).toBeVisible();
  },
};

// No current snapshot yet, so nobody is called offline.
export const WaitingForSnapshot: Story = {
  args: { cohortId: "story-waiting" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("—")).toBeVisible();
    await expect(canvas.queryByText("Offline")).not.toBeInTheDocument();
  },
};
