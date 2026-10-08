import { CohortTrackAdministration } from "@/features/admin";
import { requireRouteAccess, SessionUnavailable } from "@/features/auth";
import { firstSearchParameter } from "@/shared/lib/search-params";

interface CohortTracksPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}

export default async function CohortTracksPage({
  params,
  searchParams,
}: CohortTracksPageProps) {
  const [access, { id }, { page }] = await Promise.all([
    requireRouteAccess({ kind: "system-admin" }),
    params,
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
