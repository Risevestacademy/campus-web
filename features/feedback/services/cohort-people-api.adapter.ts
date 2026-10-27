import type { ApiClient } from "@/core/api/client";

import { type CohortPerson, parseCohortPeople } from "../schemas/people.schema";

export type CohortPeopleRead =
  { kind: "loaded"; people: CohortPerson[] } | { kind: "unavailable" };

// Any failure, a 401 included, reads as unavailable: the report still goes
// without a picked person, and sending it is what finds an ended session and
// redirects to sign-in.
export async function readCohortPeople(
  api: ApiClient,
  cohortId: string,
): Promise<CohortPeopleRead> {
  try {
    const { data, response } = await api.GET("/v1/cohorts/{id}/profiles", {
      params: { path: { id: cohortId } },
    });
    const people = response.ok ? parseCohortPeople(data) : undefined;
    return people ? { kind: "loaded", people } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
