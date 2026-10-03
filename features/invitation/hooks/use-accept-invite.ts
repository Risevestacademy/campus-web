import { useMutation } from "@tanstack/react-query";

import { ANALYTICS_EVENTS } from "@/core/analytics";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import { browserApi } from "@/core/api/client/browser";
import { replaceDocument } from "@/shared/lib/document-navigation";
import { toast } from "@/shared/ui/toast";

import { acceptInvite } from "../services/invite.service";
import type {
  ExplainedInviteProblem,
  InviteAcceptance,
} from "../types/invite.types";

const SIGN_IN_PATH = "/sign-in";

function enterCampus(destination: string) {
  captureBrowserAnalyticsEvent(ANALYTICS_EVENTS.AUTH_VERIFICATION_COMPLETED, {
    verification_type: "invite",
  });
  replaceDocument(destination);
}

function explainUnavailable() {
  toast.add({
    title: "We couldn't accept your invitation",
    description: "Nothing has changed. Check your connection and try again.",
    type: "error",
  });
}

// A full load after accepting: the proxy has just swapped the provisional
// cookie for full-access ones, and the server must read the new session.
function settle(outcome: InviteAcceptance) {
  if (outcome.kind === "accepted") enterCampus(outcome.destination);
  else if (outcome.problem === "signed-out") replaceDocument(SIGN_IN_PATH);
  else if (outcome.problem === "unavailable") explainUnavailable();
}

function explainedProblem(
  outcome: InviteAcceptance | undefined,
): ExplainedInviteProblem | undefined {
  if (outcome?.kind !== "problem") return undefined;
  const { problem } = outcome;
  return problem === "signed-out" || problem === "unavailable"
    ? undefined
    : problem;
}

export function useAcceptInvite(inviteId: string) {
  // Never retried: a lost response is indistinguishable from an answer, and a
  // second accept of a settled invite is a 409, not a recovery.
  const decision = useMutation({
    mutationFn: () => acceptInvite(browserApi, inviteId),
    retry: false,
    onSuccess: settle,
  });

  return {
    accept: () => decision.mutate(),
    // Stays busy once accepted, so the page cannot accept twice while the
    // browser loads the destination.
    isPending: decision.isPending || decision.data?.kind === "accepted",
    problem: explainedProblem(decision.data),
  };
}
