import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import { resendInvite } from "../services/invite-api.adapter";
import type { InviteResend, InviteResendProblem } from "../types/invite.types";

export function useResendInvite({
  inviteId,
  email,
}: {
  inviteId: string;
  email: string;
}) {
  const { mutate, ...controls } = useAdminMutation<
    void,
    InviteResendProblem,
    InviteResend
  >({
    mutationFn: () => resendInvite(browserApi, inviteId),
    onSucceeded: (_, outcome) => {
      toast.add(
        outcome.kind === "resent" && !outcome.emailed
          ? {
              title: "Invite renewed, but the email did not go out",
              description: `${email}. Try resending again.`,
              type: "warning",
            }
          : { title: "Invite resent", description: email, type: "success" },
      );
    },
  });

  return { resend: () => mutate(), ...controls };
}
