import { analyticsIdentityFor } from "../services/analytics-identity";
import { requireRouteAccess } from "../services/route-access.service";
import { IdentifyAnalyticsUser } from "./identify-analytics-user";

// Seeds from the request's cache()d session read, so it costs no backend call.
// Keyed by cohort: the layout instance persists across a cohort switch, and
// identify must run again with the new cohort_id.
export async function AnalyticsIdentity({ cohortId }: { cohortId: string }) {
  const access = await requireRouteAccess({ kind: "cohort", cohortId });
  if (access.kind !== "allow") return null;

  return (
    <IdentifyAnalyticsUser
      key={cohortId}
      identity={analyticsIdentityFor(access.session, cohortId)}
    />
  );
}
