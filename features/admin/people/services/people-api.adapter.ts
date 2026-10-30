import type { ApiClient } from "@/core/api/client";

import { parsePeopleList, parsePersonCard } from "../schemas/people.schema";
import type {
  CohortRole,
  PeopleCountRead,
  PeopleListRead,
  PersonCardRead,
} from "../types/people.types";

export const PEOPLE_PAGE_SIZE = 20;

interface PeopleFilters {
  search?: string;
  trackId?: string;
  cohortRole?: CohortRole;
}

export async function listPeople(
  api: ApiClient,
  cohortId: string,
  filters: PeopleFilters,
  page: number,
  perPage = PEOPLE_PAGE_SIZE,
): Promise<PeopleListRead> {
  try {
    const { data, response } = await api.GET("/v1/users", {
      params: { query: { cohortId, ...filters, page, perPage } },
    });
    const people = response.ok ? parsePeopleList(data, cohortId) : undefined;
    return people ? { kind: "loaded", ...people } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function countPeople(
  api: ApiClient,
  cohortId: string,
  cohortRole?: CohortRole,
): Promise<PeopleCountRead> {
  const read = await listPeople(api, cohortId, { cohortRole }, 1, 1);
  return read.kind === "loaded"
    ? { kind: "loaded", total: read.total }
    : { kind: "unavailable" };
}

export async function readPersonCard(
  api: ApiClient,
  userId: string,
): Promise<PersonCardRead> {
  try {
    const { data, response } = await api.GET("/v1/users/{id}/profile", {
      params: { path: { id: userId } },
    });
    if (response.status === 404) return { kind: "missing" };

    const card = response.ok ? parsePersonCard(data) : undefined;
    return card ? { kind: "loaded", card } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
