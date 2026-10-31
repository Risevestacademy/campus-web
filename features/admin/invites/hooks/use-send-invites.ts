import { useRef } from "react";

import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import { sendInvites } from "../services/send-invites.service";
import type {
  InviteFailure,
  InviteRequest,
  InvitesSent,
} from "../types/invite.types";

type Done = Extract<InvitesSent, { kind: "done" }>;

function plural(count: number): string {
  return `${count} invite${count === 1 ? "" : "s"}`;
}

function announce({ sent, notEmailed, failures }: Done) {
  if (sent === 0) return;

  if (failures.length > 0) {
    toast.add({
      title: `${plural(sent)} sent, ${failures.length} not sent`,
      description: "The rest are still in the popup.",
      type: "warning",
    });
  } else if (notEmailed > 0) {
    toast.add({
      title: `${plural(sent)} created, ${notEmailed} without an email`,
      description: "Resend those from the list.",
      type: "warning",
    });
  } else {
    toast.add({ title: `${plural(sent)} sent`, type: "success" });
  }
}

export function useSendInvites({
  onDone,
}: {
  onDone: (failures: InviteFailure[]) => void;
}) {
  const result = useRef<Done>(undefined);
  const { mutate, ...controls } = useAdminMutation<
    readonly InviteRequest[],
    "signed-out"
  >({
    mutationFn: async (requests) => {
      const outcome = await sendInvites(browserApi, requests);
      if (outcome.kind === "signed-out") {
        return { kind: "problem", problem: "signed-out" };
      }
      result.current = outcome;
      return { kind: "done" };
    },
    onSucceeded: () => {
      if (!result.current) return;
      announce(result.current);
      onDone(result.current.failures);
    },
  });

  return { send: mutate, ...controls };
}
