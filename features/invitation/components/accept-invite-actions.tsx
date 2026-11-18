"use client";

import { Button } from "@/shared/ui/button";

import { useAcceptInvite } from "../hooks/use-accept-invite";
import { InviteProblemNotice } from "./invite-problem-notice";

export function AcceptInviteActions({ inviteId }: { inviteId: string }) {
  const { accept, isPending, problem } = useAcceptInvite(inviteId);

  if (problem) return <InviteProblemNotice problem={problem} heading="h2" />;

  return (
    <div className="mt-4 flex gap-4 *:max-w-60 *:flex-1">
      <Button size="lg" variant="outline">
        Flag an Issue
      </Button>
      <Button size="lg" disabled={isPending} onClick={accept}>
        {isPending ? "Joining Campus…" : "Go to Campus"}
      </Button>
    </div>
  );
}
