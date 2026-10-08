import { z } from "zod";

import type { Session } from "../types/auth.types";

const sessionSchema = z.looseObject({
  scope: z.enum(["provisional", "full_access"]),
  expiresAt: z.iso.datetime({ offset: true }),
  inviteId: z.string().min(1).nullish(),
  user: z.looseObject({
    id: z.string().min(1),
    email: z.string().min(1),
    systemRole: z.enum(["user", "admin", "super_admin"]),
  }),
  memberships: z.array(
    z.looseObject({
      cohortId: z.string().min(1),
      role: z.enum(["student", "professor", "mentor", "guest"]),
      cohort: z.looseObject({ name: z.string(), code: z.string() }),
    }),
  ),
});

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

// Validates the fields route policies branch on, then returns the original
// value so DTO fields outside the schema are not silently dropped.
export function parseSessionBody(
  body: string | undefined,
): Session | undefined {
  const value = body ? parseJson(body) : undefined;
  return sessionSchema.safeParse(value).success
    ? (value as Session)
    : undefined;
}
