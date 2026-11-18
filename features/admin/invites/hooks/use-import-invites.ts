import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import { plural } from "../invite-format";
import { importInvites } from "../services/invite-api.adapter";
import type {
  InviteImport,
  InviteImportProblem,
  InviteImportRead,
} from "../types/invite.types";

function announce({ invited, failed, notEmailed }: InviteImport) {
  if (invited === 0) return;

  // Failed rows keep the popup open with its own summary; a toast there
  // would sit over its buttons.
  if (failed.length > 0) return;

  if (notEmailed > 0) {
    toast.add({
      title: `${plural(invited, "invite")} created, ${notEmailed} without an email`,
      description: "Resend those from the list.",
      type: "warning",
    });
  } else {
    toast.add({ title: `${plural(invited, "invite")} sent`, type: "success" });
  }
}

export function useImportInvites({
  cohortId,
  onDone,
}: {
  cohortId: string;
  onDone: (imported: InviteImport) => void;
}) {
  const { mutate, ...controls } = useAdminMutation<
    File,
    InviteImportProblem,
    InviteImportRead
  >({
    mutationFn: (file) => importInvites(browserApi, cohortId, file),
    onSucceeded: (_, read) => {
      if (read.kind !== "imported") return;
      announce(read);
      onDone(read);
    },
  });

  return { send: mutate, ...controls };
}
