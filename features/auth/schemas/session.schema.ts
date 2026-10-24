import { z } from "zod";

import {
  cohortRoleSchema,
  sessionScopeSchema,
  systemRoleSchema,
} from "@/core/api/schemas";
import { parseJson } from "@/shared/lib/parse-json";

import type { Session } from "../types/auth.types";

const sessionSchema = z.toZod<Session>()(
  z.object({
    scope: sessionScopeSchema,
    expiresAt: z.iso.datetime({ offset: true }),
    inviteId: z.string().min(1).nullish(),
    user: z.object({
      id: z.string().min(1),
      email: z.string().min(1),
      displayName: z.string().nullish(),
      systemRole: systemRoleSchema,
    }),
    memberships: z.array(
      z.object({
        cohortId: z.string().min(1),
        // Only analytics reads it: a role this build does not know drops out
        // of analytics instead of failing the whole session.
        role: cohortRoleSchema.optional().catch(undefined),
        cohort: z.object({ name: z.string(), code: z.string() }),
      }),
    ),
  }),
);

const refreshSchema = z.object({
  expiresAt: z.iso.datetime({ offset: true }),
});

export function parseSessionBody(
  body: string | undefined,
): Session | undefined {
  return parseJson(sessionSchema, body);
}

export function parseRefreshExpiry(
  body: string | undefined,
): string | undefined {
  return parseJson(refreshSchema, body)?.expiresAt;
}
