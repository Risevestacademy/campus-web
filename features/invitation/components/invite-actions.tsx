"use client";

import { useState } from "react";

import { Button } from "@/shared/ui/button";

import { useAcceptInvite } from "../hooks/use-accept-invite";
import type { ExplainedInviteProblem } from "../types/invite.types";
import { FlagInviteDialog } from "./flag-invite-dialog";
import { InviteProblemNotice } from "./invite-problem-notice";

export function InviteActions({
  inviteId,
  flagged: flaggedOnLoad,
}: {
  inviteId: string;
  flagged: boolean;
}) {
  const { accept, isPending, problem } = useAcceptInvite(inviteId);
  const [flagged, setFlagged] = useState(flaggedOnLoad);
  const [flagProblem, setFlagProblem] = useState<ExplainedInviteProblem>();

  const settled = problem ?? flagProblem;
  if (settled) return <InviteProblemNotice problem={settled} heading="h2" />;

  return (
    <div className="mt-4 grid gap-4">
      <div className="flex gap-4 *:max-w-60 *:flex-1">
        <FlagInviteDialog
          inviteId={inviteId}
          flagged={flagged}
          onFlagged={() => setFlagged(true)}
          onSettled={setFlagProblem}
        />
        <Button size="lg" disabled={isPending} onClick={accept}>
          {isPending ? "Joining Campus…" : "Go to Campus"}
        </Button>
      </div>
      {flagged ? (
        <p role="status" className="text-foreground-secondary max-w-124">
          Your Campus admin has your message. They can send you a corrected
          invitation, or you can go to Campus with this one.
        </p>
      ) : null}
    </div>
  );
}
