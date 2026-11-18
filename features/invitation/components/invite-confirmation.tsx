import type { ApiClient } from "@/core/api/client";

import { readPendingInvite } from "../services/invite.service";
import { AcceptInviteActions } from "./accept-invite-actions";
import { inviteeDetails } from "./invite-details";
import { inviteReadProblem } from "./invite-read-problem";

const PREVIEW_PATH = "/preview";

export async function InviteConfirmation({ api }: { api: ApiClient }) {
  const read = await readPendingInvite(api);
  if (read.kind === "problem") {
    return inviteReadProblem(read.problem, PREVIEW_PATH);
  }

  return (
    <div className="grid gap-6">
      <span className="text-foreground-secondary font-semibold tracking-wide uppercase">
        Check your details
      </span>
      <h1 className="font-display text-3xl font-bold">
        Are your details correct?
      </h1>
      <dl className="max-w-124 space-y-4">
        {inviteeDetails(read.invite).map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm font-medium">
        Set by campus admin - not editable here
      </p>

      <AcceptInviteActions inviteId={read.invite.id} />
    </div>
  );
}
