import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import { plural } from "../invite-format";
import { sendInvites } from "../services/send-invites.service";
import type {
  InviteFailure,
  InviteRequest,
  InvitesSent,
} from "../types/invite.types";

type Done = Extract<InvitesSent, { kind: "done" }>;

type SendOutcome = Done | { kind: "problem"; problem: "signed-out" };

function announce({ sent, notEmailed, failures }: Done) {
  if (sent === 0) return;

  const withoutEmail =
    notEmailed > 0
      ? `${notEmailed} created without an email: resend those from the list.`
      : undefined;

  if (failures.length > 0) {
    toast.add({
      title: `${plural(sent, "invite")} sent, ${failures.length} not sent`,
      description: [withoutEmail, "The rest are still in the popup."]
        .filter(Boolean)
        .join(" "),
      type: "warning",
    });
  } else if (notEmailed > 0) {
    toast.add({
      title: `${plural(sent, "invite")} created, ${notEmailed} without an email`,
      description: "Resend those from the list.",
      type: "warning",
    });
  } else {
    toast.add({ title: `${plural(sent, "invite")} sent`, type: "success" });
  }
}

// The refresh would send a signed-out session to sign-in and unmount the popup
// that still holds the addresses to retry.
function keepsUnsentAddresses(outcome: SendOutcome) {
  return (
    outcome.kind === "done" &&
    outcome.failures.some(({ problem }) => problem === "signed-out")
  );
}

export function useSendInvites({
  onDone,
}: {
  onDone: (failures: InviteFailure[]) => void;
}) {
  const { mutate, ...controls } = useAdminMutation<
    readonly InviteRequest[],
    "signed-out",
    SendOutcome
  >({
    mutationFn: async (requests) => {
      const outcome = await sendInvites(browserApi, requests);
      return outcome.kind === "signed-out"
        ? { kind: "problem", problem: "signed-out" }
        : outcome;
    },
    onSucceeded: (_, outcome) => {
      if (outcome.kind !== "done") return;
      announce(outcome);
      onDone(outcome.failures);
    },
    refreshAfterSuccess: (outcome) => !keepsUnsentAddresses(outcome),
  });

  return { send: mutate, ...controls };
}
