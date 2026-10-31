import type { Invite } from "./types/invite.types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SOON_DAYS = 2;

export interface InviteExpiry {
  text: string;
  // A pending invite with little time left.
  soon: boolean;
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

// A fixed zone, so the server and the browser print the same day.
function dayOf(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function sentOn(invite: Pick<Invite, "createdAt">): string {
  return dayOf(invite.createdAt);
}

export function describeExpiry(
  invite: Pick<Invite, "status" | "expiresAt" | "revokedAt">,
  now: number,
): InviteExpiry {
  const remaining = Date.parse(invite.expiresAt) - now;

  switch (invite.status) {
    case "pending": {
      if (remaining <= 0) return { text: "Expired", soon: false };
      const days = Math.ceil(remaining / DAY);
      return {
        text: plural(days, "day"),
        soon: days <= SOON_DAYS,
      };
    }
    case "expired": {
      const days = Math.floor(-remaining / DAY);
      return {
        text: days < 1 ? "Expired today" : `Expired ${plural(days, "day")} ago`,
        soon: false,
      };
    }
    case "revoked":
      return {
        text: dayOf(invite.revokedAt ?? invite.expiresAt),
        soon: false,
      };
    case "accepted":
      return { text: "Accepted", soon: false };
    case "declined":
      return { text: "Declined", soon: false };
  }
}
