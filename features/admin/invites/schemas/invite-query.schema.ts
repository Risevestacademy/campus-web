import { z } from "zod";

import { FIRST_PAGE, pageNumberSchema } from "@/shared/lib/search-params";

import type { InvitesQuery, InviteTab } from "../types/invite.types";

export const INVITE_TABS = [
  "pending",
  "accepted",
  "expired",
  "revoked",
] as const satisfies readonly InviteTab[];

const querySchema = z.object({
  status: z.enum(INVITE_TABS).catch("pending"),
  page: pageNumberSchema.catch(FIRST_PAGE),
});

export function parseInvitesQuery(raw: {
  status?: string;
  page?: string;
}): InvitesQuery {
  const { status, page } = querySchema.parse(raw);
  return { tab: status, page };
}
