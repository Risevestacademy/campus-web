import type { CohortContext } from "./types";

const ROLE_LABELS = {
  student: "Student",
  professor: "Professor",
  mentor: "Mentor",
  guest: "Guest",
} as const;

// An administrator may hold no place in the cohort they open, so the session
// has no name or role to show for them.
export function contextLabelFor(cohort: CohortContext | undefined): string {
  if (!cohort) return "Administrator";
  return cohort.role
    ? `${cohort.name} · ${ROLE_LABELS[cohort.role]}`
    : cohort.name;
}
