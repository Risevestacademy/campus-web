import { z } from "zod";

import { sessionScopeSchema, systemRoleSchema } from "@/core/api/schemas";

import type { Session } from "../types/auth.types";

const sessionSchema = z.toZod<Session>()(
  z.object({
    scope: sessionScopeSchema,
    expiresAt: z.iso.datetime({ offset: true }),
    inviteId: z.string().min(1).nullish(),
    user: z.object({
      email: z.string().min(1),
      displayName: z.string().nullish(),
      systemRole: systemRoleSchema,
    }),
    memberships: z.array(
      z.object({
        cohortId: z.string().min(1),
        cohort: z.object({ name: z.string(), code: z.string() }),
      }),
    ),
  }),
);

const refreshSchema = z.object({
  expiresAt: z.iso.datetime({ offset: true }),
});

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

export function parseSessionBody(
  body: string | undefined,
): Session | undefined {
  return sessionSchema.safeParse(body ? parseJson(body) : undefined).data;
}

export function parseRefreshExpiry(
  body: string | undefined,
): string | undefined {
  return refreshSchema.safeParse(body ? parseJson(body) : undefined).data
    ?.expiresAt;
}
