import { FeedbackAdministration } from "@/features/admin";
import { requireRouteAccess, SessionUnavailable } from "@/features/auth";
import { firstSearchParameter } from "@/shared/lib/search-params";

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
  const [access, { id }, query] = await Promise.all([
    requireRouteAccess({ kind: "system-admin" }),
    params,
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
