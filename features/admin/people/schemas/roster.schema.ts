import { z } from "zod";

import {
  avatarUrlSchema,
  cohortRoleSchema,
  paginationMetaWithTotalSchema,
} from "@/core/api/schemas";

import type {
  FormerMembersPage,
  RosterBody,
  RosterMember,
  StudentStatus,
} from "../types/people.types";

export const studentStatusSchema = z.toZod<StudentStatus>()(
  z.enum(["active", "dismissed", "graduated", "withdrawn", "deferred"]),
);

const dateTime = z.iso.datetime({ offset: true });

const memberSchema = z.toZod<RosterMember>()(
  z.object({
    role: cohortRoleSchema,
    status: studentStatusSchema.nullable(),
    dismissalReason: z.string().nullable(),
    leftAt: dateTime.nullable(),
    accessExpiresAt: dateTime.nullable(),
    user: z.object({
      id: z.string().min(1),
      email: z.string(),
      firstName: z.string().nullable(),
      lastName: z.string().nullable(),
      displayName: z.string().nullable(),
      avatarUrl: avatarUrlSchema,
    }),
    track: z.object({ name: z.string() }).nullable(),
  }),
);

const rosterSchema = z.toZod<RosterBody>()(
  z.object({
    items: z.array(memberSchema),
    meta: paginationMetaWithTotalSchema,
  }),
);

export function parseRoster(body: unknown): FormerMembersPage | undefined {
  const parsed = rosterSchema.safeParse(body);
  if (!parsed.success) return undefined;

  const { items, meta } = parsed.data;
  return { members: items, ...meta };
}
