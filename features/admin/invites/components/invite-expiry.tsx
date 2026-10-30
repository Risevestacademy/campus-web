import { ClockIcon } from "@phosphor-icons/react/dist/ssr/Clock";
import { cn } from "cn";

import { describeExpiry } from "../invite-format";
import type { Invite } from "../types/invite.types";

export function InviteExpiry({
  invite,
  now,
}: {
  invite: Pick<Invite, "status" | "expiresAt" | "revokedAt">;
  now: number;
}) {
  const { text, soon } = describeExpiry(invite, now);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2",
        soon
          ? "text-lemon-800 dark:text-lemon-300"
          : "text-foreground-secondary",
      )}
    >
      <ClockIcon aria-hidden size={16} />
      {text}
    </span>
  );
}
