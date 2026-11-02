import { InvitesAdministration } from "@/features/admin";
import { requireRouteAccess, SessionUnavailable } from "@/features/auth";
import { firstSearchParameter } from "@/shared/lib/search-params";

import { requireCohortId } from "../../require-cohort-id";

interface InvitesPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    status?: string | string[];
    page?: string | string[];
  }>;
}

export default async function InvitesPage({
  params,
  searchParams,
}: InvitesPageProps) {
  const id = await requireCohortId(params);
  const [access, query] = await Promise.all([
    requireRouteAccess({ kind: "system-admin" }),
    searchParams,
  ]);

  if (access.kind === "unavailable") {
    return <SessionUnavailable retryHref={access.retryHref} />;
  }

  return (
    <InvitesAdministration
      cohortId={id}
      rawQuery={{
        status: firstSearchParameter(query.status),
        page: firstSearchParameter(query.page),
      }}
    />
  );
}
