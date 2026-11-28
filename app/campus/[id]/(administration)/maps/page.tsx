import { MapsAdministration } from "@/features/admin";
import { requireRouteAccess, SessionUnavailable } from "@/features/auth";

import { requireCohortId } from "../../require-cohort-id";

interface MapsPageProps {
  params: Promise<{ id: string }>;
}

export default async function MapsPage({ params }: MapsPageProps) {
  const cohortId = await requireCohortId(params);
  const access = await requireRouteAccess({ kind: "system-admin" });

  if (access.kind === "unavailable") {
    return <SessionUnavailable retryHref={access.retryHref} />;
  }

  return <MapsAdministration cohortId={cohortId} />;
}
