import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { RoleBadge } from "./role-badge";
import type { AdminRole } from "./role-labels";

const meta = {
  title: "Features/Admin/RoleBadge",
  component: RoleBadge,
  args: { person: { systemRole: "user", role: "student" } },
} satisfies Meta<typeof RoleBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

function badge(person: AdminRole, label: string) {
  return {
    args: { person },
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      await expect(within(canvasElement).getByText(label)).toBeVisible();
    },
  } satisfies Story;
}

export const Student: Story = badge(
  { systemRole: "user", role: "student" },
  "Student",
);
export const Professor: Story = badge(
  { systemRole: "user", role: "professor" },
  "Professor",
);
export const Mentor: Story = badge(
  { systemRole: "user", role: "mentor" },
  "Mentor",
);
export const Guest: Story = badge(
  { systemRole: "user", role: "guest" },
  "Guest",
);
export const NoPlaceInTheCohort: Story = badge(
  { systemRole: "user", role: undefined },
  "Member",
);

// A system administrator reads as Admin whatever their cohort role.
export const Admin: Story = badge(
  { systemRole: "admin", role: "student" },
  "Admin",
);
export const SuperAdmin: Story = badge(
  { systemRole: "super_admin", role: undefined },
  "Admin",
);
