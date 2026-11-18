import { z } from "zod";

import { cohortRoleSchema, systemRoleSchema } from "@/core/api/schemas";

import type { InvitePreview, PendingInvite } from "../types/invite.types";

const namedSchema = z.object({ name: z.string() });
const optionalNameSchema = z.string().nullish();

const invitePreviewSchema = z.toZod<InvitePreview>()(
  z.object({
    cohort: namedSchema.nullable(),
    track: namedSchema.nullable(),
    cohortRole: cohortRoleSchema.nullish(),
    systemRole: systemRoleSchema,
    invitedBy: z.object({
      firstName: optionalNameSchema,
      lastName: optionalNameSchema,
    }),
  }),
);

const pendingInviteSchema = z.toZod<PendingInvite>()(
  z.object({
    id: z.string().min(1),
    cohort: namedSchema.nullable(),
    track: namedSchema.nullable(),
    cohortRole: cohortRoleSchema.nullish(),
    systemRole: systemRoleSchema,
    user: z.object({
      email: z.string().min(1),
      displayName: optionalNameSchema,
      firstName: optionalNameSchema,
      lastName: optionalNameSchema,
    }),
  }),
);

const acceptedSchema = z.object({
  status: z.literal("accepted"),
  membership: z.object({ cohortId: z.string().min(1) }).nullish(),
});

export function parseInvitePreview(value: unknown): InvitePreview | undefined {
  return invitePreviewSchema.safeParse(value).data;
}

export function parsePendingInvite(value: unknown): PendingInvite | undefined {
  return pendingInviteSchema.safeParse(value).data;
}

// The accepted cohort, or null for an invite that grants no cohort place.
export function parseAcceptedCohort(value: unknown): string | null | undefined {
  const parsed = acceptedSchema.safeParse(value);
  if (!parsed.success) return undefined;
  return parsed.data.membership?.cohortId ?? null;
}
