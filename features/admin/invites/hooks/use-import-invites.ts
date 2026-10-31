import { useRef } from "react";

import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import { importInvites } from "../services/invite-api.adapter";
import type {
  InviteImport,
  InviteImportProblem,
  InviteImportRead,
} from "../types/invite.types";

export function plural(count: number): string {
  return `${count} invite${count === 1 ? "" : "s"}`;
}

function announce({ invited, failed, notEmailed }: InviteImport) {
  if (invited === 0) return;

  // Failed rows keep the popup open with its own summary; a toast there
  // would sit over its buttons.
  if (failed.length > 0) return;

  if (notEmailed > 0) {
    toast.add({
      title: `${plural(invited)} created, ${notEmailed} without an email`,
      description: "Resend those from the list.",
      type: "warning",
    });
  } else {
    toast.add({ title: `${plural(invited)} sent`, type: "success" });
  }
}

export function useImportInvites({
  cohortId,
  onDone,
}: {
  cohortId: string;
  onDone: (imported: InviteImport) => void;
}) {
  const result = useRef<InviteImportRead>(undefined);
  const { mutate, ...controls } = useAdminMutation<File, InviteImportProblem>({
    mutationFn: async (file) => {
      const read = await importInvites(browserApi, cohortId, file);
      result.current = read;
      return read;
    },
    onSucceeded: () => {
      if (result.current?.kind !== "imported") return;
      announce(result.current);
      onDone(result.current);
    },
  });

  return { send: mutate, ...controls };
}
