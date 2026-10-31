import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { InviteExpiry } from "./invite-expiry";

const NOW = Date.parse("2026-10-10T12:00:00.000Z");
const DAY = 24 * 3_600_000;

const meta = {
  title: "Features/Admin/Invites/InviteExpiry",
  component: InviteExpiry,
  args: {
    now: NOW,
    invite: {
      status: "pending",
      expiresAt: new Date(NOW + 5 * DAY).toISOString(),
      revokedAt: null,
    },
  },
} satisfies Meta<typeof InviteExpiry>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Pending: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("5 days")).toBeVisible();
  },
};

// The last two days are drawn in the warning color.
export const ExpiresSoon: Story = {
  args: {
    invite: {
      status: "pending",
      expiresAt: new Date(NOW + DAY).toISOString(),
      revokedAt: null,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("1 day")).toBeVisible();
  },
};

export const Expired: Story = {
  args: {
    invite: {
      status: "expired",
      expiresAt: new Date(NOW - 3 * DAY).toISOString(),
      revokedAt: null,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Expired 3 days ago"),
    ).toBeVisible();
  },
};

export const Revoked: Story = {
  args: {
    invite: {
      status: "revoked",
      expiresAt: new Date(NOW + 2 * DAY).toISOString(),
      revokedAt: "2026-10-04T09:00:00.000Z",
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("4 Oct 2026")).toBeVisible();
  },
};

export const Accepted: Story = {
  args: {
    invite: {
      status: "accepted",
      expiresAt: new Date(NOW + 2 * DAY).toISOString(),
      revokedAt: null,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Accepted")).toBeVisible();
  },
};
