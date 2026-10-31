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
        soon
          ? "text-lemon-800 dark:text-lemon-300"
          : "text-foreground-secondary",
      )}
    >
      {text}
    </span>
  );
}
