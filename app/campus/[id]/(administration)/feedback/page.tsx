import { FeedbackAdministration } from "@/features/admin";
import { requireRouteAccess, SessionUnavailable } from "@/features/auth";
import { firstSearchParameter } from "@/shared/lib/search-params";

import { requireCohortId } from "../../require-cohort-id";

interface FeedbackPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string | string[];
    filter?: string | string[];
    page?: string | string[];
    item?: string | string[];
  }>;
}

export default async function FeedbackPage({
  params,
  searchParams,
}: FeedbackPageProps) {
  const id = await requireCohortId(params);
  const [access, query] = await Promise.all([
    requireRouteAccess({ kind: "system-admin" }),
    searchParams,
  ]);

  if (access.kind === "unavailable") {
    return <SessionUnavailable retryHref={access.retryHref} />;
  }

  return (
    <FeedbackAdministration
      cohortId={id}
      rawQuery={{
        tab: firstSearchParameter(query.tab),
        filter: firstSearchParameter(query.filter),
        page: firstSearchParameter(query.page),
        item: firstSearchParameter(query.item),
      }}
    />
  );
}
