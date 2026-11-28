import { z } from "zod";

import { cohortRoleSchema } from "@/core/api/schemas";
import { FIRST_PAGE, pageNumberSchema } from "@/shared/lib/search-params";

import type { PeopleChip, PeopleQuery } from "../types/people.types";

export const PEOPLE_CHIPS: readonly PeopleChip[] = [
  "all",
  ...cohortRoleSchema.options,
];

const SEARCH_MAX_LENGTH = 128;

const querySchema = z.object({
  members: z.enum(["current", "former"]).catch("current"),
  role: z.union([z.literal("all"), cohortRoleSchema]).catch("all"),
  q: z.string().trim().max(SEARCH_MAX_LENGTH).optional().catch(undefined),
  track: z.uuid().optional().catch(undefined),
  page: pageNumberSchema.catch(FIRST_PAGE),
});

export function parsePeopleQuery(raw: {
  members?: string;
  role?: string;
  q?: string;
  track?: string;
  page?: string;
}): PeopleQuery {
  const { members, role, q, track, page } = querySchema.parse(raw);

  return {
    scope: members,
    chip: role,
    // The roster of former members has no search, so none is kept for it.
    search: members === "current" ? q || undefined : undefined,
    trackId: track,
    page,
  };
}
