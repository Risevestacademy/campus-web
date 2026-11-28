import { useMutation } from "@tanstack/react-query";

import { browserApi } from "@/core/api/client/browser";
import { SIGN_IN_PATH } from "@/core/navigation";
import { replaceDocument } from "@/shared/lib/document-navigation";

import { flagInvite } from "../services/invite.service";
import type {
  ExplainedInviteProblem,
  InviteFlagging,
} from "../types/invite.types";

interface FlagInviteOptions {
  inviteId: string;
  onFlagged: () => void;
  // The invite can no longer be answered; the page explains why.
  onSettled: (problem: ExplainedInviteProblem) => void;
}

export function useFlagInvite({
  inviteId,
  onFlagged,
  onSettled,
}: FlagInviteOptions) {
  // Not retried: campus-api emails the admin on the first flag, and a second
  // send could only be a 409.
  const flag = useMutation({
    mutationFn: (message: string) =>
      flagInvite(browserApi, { message, inviteId }),
    retry: false,
    onSuccess: (outcome: InviteFlagging) => {
      if (outcome.kind === "flagged") onFlagged();
      else if (outcome.problem === "signed-out") replaceDocument(SIGN_IN_PATH);
      else if (outcome.problem !== "unavailable") onSettled(outcome.problem);
    },
  });

  return {
    send: (message: string) => flag.mutate(message),
    isPending: flag.isPending,
    // Nothing was recorded; the message stays in the field to send again.
    failed:
      flag.data?.kind === "problem" && flag.data.problem === "unavailable",
    reset: flag.reset,
  };
}
