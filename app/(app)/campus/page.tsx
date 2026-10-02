import Link from "next/link";

import { getServerApi } from "@/core/api/client/server";
import { requireRouteAccess, SessionUnavailable } from "@/features/auth";
import { CohortChooser } from "@/features/campus";
import { firstSearchParameter } from "@/shared/lib/search-params";

interface CampusPageProps {
  searchParams: Promise<{ page?: string | string[] }>;
}

export default async function CampusPage({ searchParams }: CampusPageProps) {
  const [access, { page }, api] = await Promise.all([
    requireRouteAccess({ kind: "campus-index" }),
    searchParams,
    getServerApi(),
  ]);

  if (access.kind === "unavailable") {
    return <SessionUnavailable retryHref={access.retryHref} />;
  }

  return (
    <div data-surface-role="background" className="bg-background space-y-8">
      <header className="flex h-16 items-end px-10">
        <Link href={"/"} className="flex items-center gap-3">
          <figure
            data-surface-role="surface"
            className="bg-surface ring-border size-12 rounded-xl ring"
          ></figure>
          <h1 className="text-xl font-medium">Campus by Rise</h1>
        </Link>
      </header>

      <div className="px-10">
        <CohortChooser
          viewer={access.session}
          page={firstSearchParameter(page)}
          api={api}
        />
      </div>
    </div>
  );
}
