import type { components } from "@/core/api/client";

import type {
  InvitePreview,
  PendingInvite,
  SystemRole,
} from "../types/invite.types";

type Role = components["schemas"]["CohortRole"] | SystemRole;

export interface InviteDetail {
  label: string;
  value: string;
}

const ROLE_LABELS: Readonly<Record<Role, string>> = {
  student: "Student",
  professor: "Professor",
  mentor: "Mentor",
  guest: "Guest",
  admin: "Admin",
  super_admin: "Super Admin",
  user: "Member",
};

// An admin invite joins no cohort and carries no cohortRole.
export function roleLabel({
  cohortRole,
  systemRole,
}: Pick<InvitePreview, "cohortRole" | "systemRole">): string {
  return ROLE_LABELS[cohortRole ?? systemRole];
}

interface Named {
  name: string;
}

// "Backend Engineering Cohort 2" for a track invite, the cohort alone otherwise.
export function cohortTitle({
  cohort,
  track,
}: {
  cohort: Named | null;
  track: Named | null;
}): string | undefined {
  if (cohort === null) return undefined;
  return track ? `${track.name} ${cohort.name}` : cohort.name;
}

// "Cohort • Cohort 1" says it twice: a value that already names its label
// stands alone, while "Cohort • Product Design 2026" keeps the label.
export function chipText({ label, value }: InviteDetail): string {
  return value.toLowerCase().startsWith(label.toLowerCase())
    ? value
    : `${label} • ${value}`;
}

function fullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  return [firstName, lastName].filter(Boolean).join(" ");
}

function present(details: (InviteDetail | false)[]): InviteDetail[] {
  return details.filter(
    (detail): detail is InviteDetail => detail !== false && detail.value !== "",
  );
}

export function offerDetails(preview: InvitePreview): InviteDetail[] {
  const { firstName, lastName } = preview.invitedBy;
  return present([
    { label: "Invited by", value: fullName(firstName, lastName) },
    { label: "Role", value: roleLabel(preview) },
    preview.cohort !== null && { label: "Cohort", value: preview.cohort.name },
  ]);
}

export function inviteeDetails(invite: PendingInvite): InviteDetail[] {
  const { displayName, firstName, lastName, email } = invite.user;
  const cohort = cohortTitle(invite);
  return present([
    // Google's display name can be the first name alone; the parts are fuller.
    {
      label: "Name",
      value: fullName(firstName, lastName) || displayName || "",
    },
    { label: "Email", value: email },
    { label: "Role", value: roleLabel(invite) },
    cohort !== undefined && { label: "Cohort", value: cohort },
  ]);
}
