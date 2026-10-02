import type { ApiClient } from "@/core/api/client";

import { parseCohortList } from "../schemas/cohort.schema";
import type { CohortPage } from "../types/cohort.types";

export type CohortListRead =
  ({ kind: "loaded" } & CohortPage) | { kind: "unavailable" };

const UNAVAILABLE: CohortListRead = { kind: "unavailable" };

export async function listCohorts(
  api: ApiClient,
  page: number,
): Promise<CohortListRead> {
  try {
    const { data, response } = await api.GET("/v1/cohorts", {
      params: { query: { page } },
    });
    if (!response.ok) return UNAVAILABLE;

    const cohortPage = parseCohortList(data);
    return cohortPage ? { kind: "loaded", ...cohortPage } : UNAVAILABLE;
  } catch {
    return UNAVAILABLE;
  }
}
