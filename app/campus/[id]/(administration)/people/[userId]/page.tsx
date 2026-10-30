import { PersonAdministration } from "@/features/admin";
import { requireRouteAccess, SessionUnavailable } from "@/features/auth";

import { requireCohortId } from "../../../require-cohort-id";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>;
}) {
  const id = await requireCohortId(params);
  const [{ userId }, access] = await Promise.all([
    params,
    requireRouteAccess({ kind: "system-admin" }),
  ]);

  if (access.kind === "unavailable") {
    return <SessionUnavailable retryHref={access.retryHref} />;
  }

  return <PersonAdministration cohortId={id} userId={userId} />;
}
