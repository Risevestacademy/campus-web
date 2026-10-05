import type { Metadata } from "next";

import { getServerApi } from "@/core/api/client/server";
import { ResumeInvitation } from "@/features/auth";
import { InvitationOffer } from "@/features/invitation";
import { firstSearchParameter } from "@/shared/lib/search-params";

// The invite token rides in the query string; never pass it on as a Referer.
export const metadata: Metadata = { referrer: "no-referrer" };

interface InvitationPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

export default async function InvitationPage({
  searchParams,
}: InvitationPageProps) {
  const token = firstSearchParameter((await searchParams).token);
  if (!token) return <ResumeInvitation />;

  // The preview needs no session, but campus-api rate-limits per client
  // address and only the default server client forwards X-Forwarded-For.
  return <InvitationOffer api={await getServerApi()} token={token} />;
}
