import { z } from "zod";

import { cohortRoleSchema, systemRoleSchema } from "@/core/api/schemas";

import type { GrantSubject, SpaceGrant } from "../types/maps.types";

// Only what names the subject in the list: the ids it carries are not shown,
// and ending a grant needs only the grant's own id.
const subjectSchema = z.toZod<GrantSubject>()(
  z.object({
    type: z.enum([
      "user",
      "cohort_track",
      "cohort_role",
      "system_role",
      "mentorship_group",
    ]),
    displayName: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    trackName: z.string().nullable().optional(),
    cohortRole: cohortRoleSchema.optional(),
    systemRole: systemRoleSchema.optional(),
    groupName: z.string().optional(),
  }),
);

const grantSchema = z.toZod<SpaceGrant>()(
  z.object({
    id: z.string().min(1),
    live: z.boolean(),
    subject: subjectSchema,
  }),
);

export function parseSpaceGrants(body: unknown): SpaceGrant[] | undefined {
  return z.array(grantSchema).safeParse(body).data;
}
