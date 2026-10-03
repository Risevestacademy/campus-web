import { getServerApi } from "@/core/api/client/server";
import { InvitationGate } from "@/features/auth";
import { InviteConfirmation } from "@/features/invitation";

export default async function ProfilePreviewPage() {
  return (
    <InvitationGate path="/preview">
      <InviteConfirmation api={await getServerApi()} />
    </InvitationGate>
  );
}
