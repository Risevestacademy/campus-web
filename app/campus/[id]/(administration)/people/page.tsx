import { PeopleAdministration } from "@/features/admin";
import { requireRouteAccess, SessionUnavailable } from "@/features/auth";
import { firstSearchParameter } from "@/shared/lib/search-params";

import { requireCohortId } from "../../require-cohort-id";

interface PeoplePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    role?: string | string[];
    q?: string | string[];
    track?: string | string[];
    page?: string | string[];
  }>;
}

export default async function PeoplePage({
  params,
  searchParams,
}: PeoplePageProps) {
  const id = await requireCohortId(params);
  const [access, query] = await Promise.all([
    requireRouteAccess({ kind: "system-admin" }),
    searchParams,
  ]);

  if (access.kind === "unavailable") {
    return <SessionUnavailable retryHref={access.retryHref} />;
  }

  return (
    <PeopleAdministration
      cohortId={id}
      rawQuery={{
        role: firstSearchParameter(query.role),
        q: firstSearchParameter(query.q),
        track: firstSearchParameter(query.track),
        page: firstSearchParameter(query.page),
      }}
    />
  );
}
