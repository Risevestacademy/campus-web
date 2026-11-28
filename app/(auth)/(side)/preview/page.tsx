import type { Metadata } from "next";

import { getServerApi } from "@/core/api/client/server";
import { InvitationGate } from "@/features/auth";
import { InviteConfirmation } from "@/features/invitation";

import { Providers } from "../../../providers";

export const metadata: Metadata = { title: "Confirm your profile" };

export default async function ProfilePreviewPage() {
  return (
    <Providers>
      <InvitationGate path="/preview">
        <InviteConfirmation api={await getServerApi()} />
      </InvitationGate>
    </Providers>
  );
}
