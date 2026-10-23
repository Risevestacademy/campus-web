import {
  memberAnalyticsFor,
  memberAnalyticsKey,
} from "../services/member-analytics";
import { requireRouteAccess } from "../services/route-access.service";
import { CohortAnalytics } from "./cohort-analytics";
import { SessionRenewalTimer } from "./session-renewal-timer";

// Seeds from the request's cache()d session read, so it costs no backend call.
// Each key restarts its client when the seed changes.
export async function CohortSession({ cohortId }: { cohortId: string }) {
  const access = await requireRouteAccess({ kind: "cohort", cohortId });
  if (access.kind !== "allow") return null;

  const { expiresAt } = access.session;
  const analytics = memberAnalyticsFor(access.session, cohortId);
  return (
    <>
      <SessionRenewalTimer key={expiresAt} expiresAt={expiresAt} />
      <CohortAnalytics key={memberAnalyticsKey(analytics)} {...analytics} />
    </>
  );
}
