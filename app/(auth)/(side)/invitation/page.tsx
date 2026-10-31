import type { Metadata } from "next";

import { getServerApi } from "@/core/api/client/server";
import {
  ForgetPreviousMember,
  isSignedOut,
  ResumeInvitation,
} from "@/features/auth";
import {
  InvitationOffer,
  MissingInviteLinkNotice,
  readInviteToken,
} from "@/features/invitation";

// The proxy moves the invite token into a cookie before render; this stops a
// stray one from ever leaving as a Referer.
export const metadata: Metadata = { referrer: "no-referrer" };

export default async function InvitationPage() {
  const token = await readInviteToken();
  const signedOut = await isSignedOut();
  // Only a session has something to resume; signed out, refresh would only
  // end at sign-in.
  if (!token && !signedOut) return <ResumeInvitation />;

  // Neither screen below passes through /sign-in, so forget here too; a member
  // still signed in keeps their identity.
  const forgetPreviousMember = signedOut && <ForgetPreviousMember />;

  if (!token) {
    return (
      <>
        {forgetPreviousMember}
        <MissingInviteLinkNotice />
      </>
    );
  }

  // The preview needs no session, but campus-api rate-limits per client
  // address and only the default server client forwards the visitor's.
  return (
    <>
      {forgetPreviousMember}
      <InvitationOffer api={await getServerApi()} token={token} />
    </>
  );
}
