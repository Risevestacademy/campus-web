import type { AnalyticsIdentity } from "@/core/analytics";

import type { Session } from "../types/auth.types";

export function analyticsIdentityFor(
  session: Session,
  cohortId: string,
): AnalyticsIdentity {
  const place = session.memberships.find(
    (membership) => membership.cohortId === cohortId,
  );
  return {
    id: session.user.id,
    cohortId,
    role: place?.role ?? session.user.systemRole,
  };
}
