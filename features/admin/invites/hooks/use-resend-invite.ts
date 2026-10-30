import { useRef } from "react";

import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import { resendInvite } from "../services/invite-api.adapter";
import type { InviteResendProblem } from "../types/invite.types";

export function useResendInvite({
  inviteId,
  email,
}: {
  inviteId: string;
  email: string;
}) {
  const emailed = useRef(true);
  const { mutate, ...controls } = useAdminMutation<void, InviteResendProblem>({
    mutationFn: async () => {
      const outcome = await resendInvite(browserApi, inviteId);
      if (outcome.kind === "resent") emailed.current = outcome.emailed;
      return outcome;
    },
    onSucceeded: () => {
      toast.add(
        emailed.current
          ? { title: "Invite resent", description: email, type: "success" }
          : {
              title: "Invite renewed, but the email did not go out",
              description: `${email}. Try resending again.`,
              type: "warning",
            },
      );
    },
  });

  return { resend: () => mutate(), ...controls };
}
