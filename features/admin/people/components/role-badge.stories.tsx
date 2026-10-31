import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import type { Person } from "../types/people.types";
import { RoleBadge } from "./role-badge";

const meta = {
  title: "Features/Admin/People/RoleBadge",
  component: RoleBadge,
  args: { person: { systemRole: "user", role: "student" } },
} satisfies Meta<typeof RoleBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

function badge(person: Pick<Person, "systemRole" | "role">, label: string) {
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
