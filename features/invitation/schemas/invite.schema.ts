import { z } from "zod";

import type { InvitePreview, PendingInvite } from "../types/invite.types";

const cohortRole = z.enum(["student", "professor", "mentor", "guest"]);
const systemRole = z.enum(["user", "admin", "super_admin"]);
const namedCohort = z.looseObject({ name: z.string() }).nullable();
const optionalName = z.string().nullish();

const previewSchema = z.looseObject({
  email: z.string().min(1),
  cohort: namedCohort,
  cohortRole: cohortRole.nullish(),
  systemRole,
  invitedBy: z.looseObject({
    firstName: optionalName,
    lastName: optionalName,
  }),
});

const pendingInviteSchema = z.looseObject({
  id: z.string().min(1),
  cohort: namedCohort,
  cohortRole: cohortRole.nullish(),
  systemRole,
  user: z.looseObject({
    email: z.string().min(1),
    displayName: optionalName,
    firstName: optionalName,
    lastName: optionalName,
  }),
});

const acceptedSchema = z.looseObject({
  status: z.literal("accepted"),
  membership: z.looseObject({ cohortId: z.string().min(1) }).nullish(),
});

const errorSchema = z.looseObject({
  error: z.looseObject({ code: z.string() }),
});

// Validates the fields screens render, then returns the original value so DTO
// fields outside the schema are not silently dropped.
function validated<T>(schema: z.ZodType, value: unknown): T | undefined {
  return schema.safeParse(value).success ? (value as T) : undefined;
}

export function parseInvitePreview(value: unknown): InvitePreview | undefined {
  return validated<InvitePreview>(previewSchema, value);
}

export function parsePendingInvite(value: unknown): PendingInvite | undefined {
  return validated<PendingInvite>(pendingInviteSchema, value);
}

// The accepted cohort, or null for an invite that grants no cohort place.
export function parseAcceptedCohort(value: unknown): string | null | undefined {
  const parsed = acceptedSchema.safeParse(value);
  if (!parsed.success) return undefined;
  return parsed.data.membership?.cohortId ?? null;
}

export function parseErrorCode(value: unknown): string | undefined {
  const parsed = errorSchema.safeParse(value);
  return parsed.success ? parsed.data.error.code : undefined;
}
