import { CohortTrackAdministration } from "@/features/admin";
import { requireRouteAccess, SessionUnavailable } from "@/features/auth";
import { firstSearchParameter } from "@/shared/lib/search-params";

import { requireCohortId } from "../../require-cohort-id";

interface CohortTracksPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}

export default async function CohortTracksPage({
  params,
  searchParams,
}: CohortTracksPageProps) {
  const id = await requireCohortId(params);
  const [access, { page }] = await Promise.all([
    requireRouteAccess({ kind: "system-admin" }),
    searchParams,
  ]);

  if (access.kind === "unavailable") {
    return <SessionUnavailable retryHref={access.retryHref} />;
  }

  return (
    <CohortTrackAdministration
      cohortId={id}
      page={firstSearchParameter(page)}
    />
  );
}
