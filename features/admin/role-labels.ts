import type { components } from "@/core/api/client";

type Schemas = components["schemas"];

export interface AdminRole {
  systemRole: Schemas["SystemRole"];
  role: Schemas["CohortRole"] | undefined;
}

export const ROLE_LABELS: Readonly<Record<Schemas["CohortRole"], string>> = {
  student: "Student",
  professor: "Professor",
  mentor: "Mentor",
  guest: "Guest",
};

// A system administrator reads as Admin whatever their cohort role.
export function roleLabelOf({ systemRole, role }: AdminRole): string {
  if (systemRole !== "user") return "Admin";
  return role ? ROLE_LABELS[role] : "Member";
}
