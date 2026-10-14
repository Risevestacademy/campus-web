import type { Metadata } from "next";

import { getServerApi } from "@/core/api/client/server";
import { ResumeInvitation } from "@/features/auth";
import { InvitationOffer, readInviteToken } from "@/features/invitation";

// The proxy moves the invite token into a cookie before render; this stops a
// stray one from ever leaving as a Referer.
export const metadata: Metadata = { referrer: "no-referrer" };

export default async function InvitationPage() {
  const token = await readInviteToken();
  if (!token) return <ResumeInvitation />;

  // The preview needs no session, but campus-api rate-limits per client
  // address and only the default server client forwards X-Forwarded-For.
  return <InvitationOffer api={await getServerApi()} token={token} />;
}
