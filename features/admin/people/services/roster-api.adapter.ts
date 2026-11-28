import type { ApiClient } from "@/core/api/client";

import { parseRoster } from "../schemas/roster.schema";
import type {
  CohortRole,
  FormerMembersRead,
  PeopleCountRead,
} from "../types/people.types";
import { PEOPLE_PAGE_SIZE } from "./people-api.adapter";

interface RosterFilters {
  role?: CohortRole;
  trackId?: string;
}

// The people who were in the cohort: left, dismissed, withdrawn, deferred,
// graduated, removed, or guests whose visit is over. The people in it now are
// read from `GET /v1/users`, which can search and carries the account's
// system role; the roster does neither.
export async function listFormerMembers(
  api: ApiClient,
  cohortId: string,
  filters: RosterFilters,
  page: number,
  perPage = PEOPLE_PAGE_SIZE,
): Promise<FormerMembersRead> {
  try {
    const { data, response } = await api.GET("/v1/cohorts/{id}/members", {
      params: {
        path: { id: cohortId },
        query: { state: "ended", ...filters, page, perPage },
      },
    });
    const roster = response.ok ? parseRoster(data) : undefined;
    return roster ? { kind: "loaded", ...roster } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function countFormerMembers(
  api: ApiClient,
  cohortId: string,
  role?: CohortRole,
): Promise<PeopleCountRead> {
  const read = await listFormerMembers(api, cohortId, { role }, 1, 1);
  return read.kind === "loaded"
    ? { kind: "loaded", total: read.total }
    : { kind: "unavailable" };
}
