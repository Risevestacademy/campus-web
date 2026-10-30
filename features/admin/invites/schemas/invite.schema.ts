import { z } from "zod";

import {
  cohortRoleSchema,
  paginationMetaWithTotalSchema,
} from "@/core/api/schemas";

import type { InvitesBody, InvitesPage } from "../types/invite.types";

const inviteSchema = z.toZod<InvitesBody["items"][number]>()(
  z.object({
    id: z.string().min(1),
    email: z.string(),
    status: z.enum(["pending", "accepted", "declined", "revoked", "expired"]),
    cohortRole: cohortRoleSchema.nullable(),
    expiresAt: z.string(),
    revokedAt: z.string().nullable(),
    createdAt: z.string(),
  }),
);

const listSchema = z.toZod<InvitesBody>()(
  z.object({
    items: z.array(inviteSchema),
    meta: paginationMetaWithTotalSchema,
  }),
);

export function parseInvites(body: unknown): InvitesPage | undefined {
  const parsed = listSchema.safeParse(body);
  if (!parsed.success) return undefined;

  return { invites: parsed.data.items, ...parsed.data.meta };
}

// What a resend answers with: only whether the email went out is read. The
// link in it is a secret shown once, and nothing here shows it.
const emailStatusSchema = z.object({
  emailStatus: z.enum(["sent", "failed", "disabled"]),
});

export function parseEmailed(body: unknown): boolean | undefined {
  const parsed = emailStatusSchema.safeParse(body);
  return parsed.success ? parsed.data.emailStatus === "sent" : undefined;
}
