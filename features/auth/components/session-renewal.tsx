import { requireRouteAccess } from "../services/route-access.service";
import { SessionRenewalTimer } from "./session-renewal-timer";

// Seeds from the request's cache()d session read, so it costs no backend call.
// Keyed by expiry: a later seed (a cohort switch) restarts the schedule.
export async function SessionRenewal({ cohortId }: { cohortId: string }) {
  const access = await requireRouteAccess({ kind: "cohort", cohortId });
  if (access.kind !== "allow") return null;

  const { expiresAt } = access.session;
  return <SessionRenewalTimer key={expiresAt} expiresAt={expiresAt} />;
}
