"use client";

import { Button } from "@/shared/ui/button";

import { useResendInvite } from "../hooks/use-resend-invite";
import { useRevokeInvite } from "../hooks/use-revoke-invite";
import type {
  InviteResendProblem,
  InviteRevokeProblem,
  InviteStatus,
} from "../types/invite.types";

const RESEND_PROBLEMS: Record<InviteResendProblem, string | undefined> = {
  invalid: "campus-api rejected this request. Refresh the page and try again.",
  "signed-out": undefined,
  forbidden: "You no longer have permission to resend invites.",
  missing: "This invite no longer exists. Refresh the page.",
  settled: "This invite was answered or revoked. Refresh the page.",
  conflict:
    "This address already has another pending invite, or has joined. Refresh the page.",
  unavailable:
    "We couldn't resend this invite. Check your connection and try again.",
};

const REVOKE_PROBLEMS: Record<InviteRevokeProblem, string | undefined> = {
  invalid: "campus-api rejected this request. Refresh the page and try again.",
  "signed-out": undefined,
  forbidden: "You no longer have permission to revoke invites.",
  missing: "This invite no longer exists. Refresh the page.",
  settled: "This invite was already answered or revoked. Refresh the page.",
  expired: "This invite has expired, so there is nothing to revoke.",
  unavailable:
    "We couldn't revoke this invite. Nothing was changed. Check your connection and try again.",
};

export function InviteActions({
  inviteId,
  email,
  status,
}: {
  inviteId: string;
  email: string;
  status: InviteStatus;
}) {
  const resend = useResendInvite({ inviteId, email });
  const revoke = useRevokeInvite({ inviteId, email });
  const canResend = status === "pending" || status === "expired";
  const canRevoke = status === "pending";
  const messages = [
    resend.problem ? RESEND_PROBLEMS[resend.problem] : undefined,
    revoke.problem ? REVOKE_PROBLEMS[revoke.problem] : undefined,
  ].filter(Boolean);

  if (!canResend && !canRevoke) return null;

  return (
    <div className="grid justify-items-end gap-2">
      <div className="flex items-center justify-end gap-1">
        {canResend ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={resend.isPending || revoke.isPending}
            aria-label={`Resend invite to ${email}`}
            onClick={resend.resend}
            className="text-primary dark:text-cobalt-300 hover:text-primary dark:hover:text-cobalt-300 hover:bg-[#E9ECF6] dark:hover:bg-[#2B3B5F]"
          >
            Resend
          </Button>
        ) : null}
        {canRevoke ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={resend.isPending || revoke.isPending}
            aria-label={`Revoke invite to ${email}`}
            onClick={revoke.revoke}
            className="text-error-700 dark:text-error-300 hover:text-error-700 dark:hover:text-error-300 hover:bg-error-100 dark:hover:bg-error-900/40"
          >
            Revoke
          </Button>
        ) : null}
      </div>
      {messages.map((message) => (
        <p
          key={message}
          role="alert"
          className="text-destructive max-w-64 text-right text-sm"
        >
          {message}
        </p>
      ))}
    </div>
  );
}
