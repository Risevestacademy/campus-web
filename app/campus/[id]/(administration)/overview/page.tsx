import { CohortAdministrationOverview } from "@/features/admin";
import { requireRouteAccess, SessionUnavailable } from "@/features/auth";

import { requireCohortId } from "../../require-cohort-id";

export default async function AdministrationOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = await requireCohortId(params);
  const access = await requireRouteAccess({ kind: "system-admin" });

  if (access.kind === "unavailable") {
    return <SessionUnavailable retryHref={access.retryHref} />;
  }

  return (
    <CohortAdministrationOverview
      cohortId={id}
      adminName={access.session.user.displayName}
    />
  );
}
