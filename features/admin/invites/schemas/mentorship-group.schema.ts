import { z } from "zod";

import { paginationMetaSchema } from "@/core/api/schemas";

import type { GroupsBody, InviteGroupOption } from "../types/invite.types";

const groupsSchema = z.toZod<GroupsBody>()(
  z.object({
    items: z.array(
      z.object({
        id: z.string().min(1),
        name: z.string(),
        mentor: z.object({
          user: z.object({
            displayName: z.string().nullable(),
            firstName: z.string().nullable(),
          }),
        }),
      }),
    ),
    meta: paginationMetaSchema,
  }),
);

export interface GroupOptionsPage {
  options: InviteGroupOption[];
  totalPages: number;
}

export function parseGroupOptions(body: unknown): GroupOptionsPage | undefined {
  const parsed = groupsSchema.safeParse(body);
  if (!parsed.success) return undefined;

  return {
    totalPages: parsed.data.meta.totalPages,
    options: parsed.data.items.map(({ id, name, mentor }) => ({
      id,
      name,
      mentorName:
        mentor.user.displayName?.trim() ||
        mentor.user.firstName?.trim() ||
        undefined,
    })),
  };
}
