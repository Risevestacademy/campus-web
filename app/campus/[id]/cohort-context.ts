import type { Session } from "@/features/auth";

// The member's place in this cohort. An administrator may hold none.
export function cohortContextOf(session: Session, cohortId: string) {
  const place = session.memberships.find(
    (membership) => membership.cohortId === cohortId,
  );
  return place && { name: place.cohort.name, role: place.role };
}
