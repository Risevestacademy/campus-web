import type { ApiClient } from "@/core/api/client";

import {
  type DirectoryPerson,
  parseCohortDirectory,
} from "../schemas/directory.schema";

export type CohortDirectoryRead =
  { kind: "loaded"; people: DirectoryPerson[] } | { kind: "unavailable" };

// Any failure reads as unavailable: the roster then hides its Offline group
// instead of showing a count it could not check.
export async function readCohortDirectory(
  api: ApiClient,
  cohortId: string,
): Promise<CohortDirectoryRead> {
  try {
    const { data, response } = await api.GET("/v1/cohorts/{id}/profiles", {
      params: { path: { id: cohortId } },
    });
    const people = response.ok ? parseCohortDirectory(data) : undefined;
    return people ? { kind: "loaded", people } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
