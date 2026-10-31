import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import { revokeInvite } from "../services/invite-api.adapter";
import type { InviteRevokeProblem } from "../types/invite.types";

export function useRevokeInvite({
  inviteId,
  email,
}: {
  inviteId: string;
  email: string;
}) {
  const { mutate, ...controls } = useAdminMutation<void, InviteRevokeProblem>({
    mutationFn: () => revokeInvite(browserApi, inviteId),
    onSucceeded: () => {
      toast.add({
        title: "Invite revoked",
        description: email,
        type: "success",
      });
    },
  });

  return { revoke: () => mutate(), ...controls };
}
