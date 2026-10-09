import { CohortAdministrationOverview } from "@/features/admin";
import { requireRouteAccess, SessionUnavailable } from "@/features/auth";

export default async function AdministrationOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [access, { id }] = await Promise.all([
    requireRouteAccess({ kind: "system-admin" }),
    params,
  ]);

  if (access.kind === "unavailable") {
    return <SessionUnavailable retryHref={access.retryHref} />;
  }

  return <CohortAdministrationOverview cohortId={id} />;
}
