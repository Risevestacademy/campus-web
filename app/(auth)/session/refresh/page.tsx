import { normalizeReturnTo, RefreshSession } from "@/features/auth";
import { firstSearchParameter } from "@/shared/lib/search-params";

import { Providers } from "../../../providers";

interface SessionRefreshPageProps {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}

export default async function SessionRefreshPage({
  searchParams,
}: SessionRefreshPageProps) {
  const { returnTo } = await searchParams;

  return (
    <Providers>
      <RefreshSession
        returnTo={normalizeReturnTo(firstSearchParameter(returnTo))}
      />
    </Providers>
  );
}
