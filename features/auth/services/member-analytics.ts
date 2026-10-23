import type { AnalyticsCohort, AnalyticsIdentity } from "@/core/analytics";

import type { Session } from "../types/auth.types";

export interface MemberAnalytics {
  identity: AnalyticsIdentity;
  cohort: AnalyticsCohort;
}

export function memberAnalyticsFor(
  session: Session,
  cohortId: string,
): MemberAnalytics {
  const place = session.memberships.find(
    (membership) => membership.cohortId === cohortId,
  );
  return {
    identity: { id: session.user.id, systemRole: session.user.systemRole },
    cohort: { cohortId, cohortRole: place?.role },
  };
}

// router.refresh() re-renders the layout without remounting it; a new key
// remounts CohortAnalytics, so a changed role reaches PostHog.
export function memberAnalyticsKey({
  identity,
  cohort,
}: MemberAnalytics): string {
  return [
    identity.id,
    identity.systemRole,
    cohort.cohortId,
    cohort.cohortRole ?? "none",
  ].join(":");
}
