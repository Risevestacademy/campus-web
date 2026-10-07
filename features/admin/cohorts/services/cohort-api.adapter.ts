import type { ApiClient } from "@/core/api/client";

import { parseCohortList } from "../schemas/cohort.schema";
import type {
  CohortCreation,
  CohortCreationProblem,
  CohortListRead,
  NewCohort,
} from "../types/cohort.types";

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

// On this route a 409 has one meaning: another cohort already uses the code.
const CREATION_PROBLEMS: Readonly<Record<number, CohortCreationProblem>> = {
  400: "rejected",
  401: "signed-out",
  409: "duplicate-code",
};

const creationProblem = (problem: CohortCreationProblem): CohortCreation => ({
  kind: "problem",
  problem,
});

// openapi-fetch throws alike for a network failure and an unparseable body.
export async function createCohort(
  api: ApiClient,
  cohort: NewCohort,
): Promise<CohortCreation> {
  try {
    const { response } = await api.POST("/v1/cohorts", { body: cohort });
    return response.ok
      ? { kind: "created" }
      : creationProblem(CREATION_PROBLEMS[response.status] ?? "unavailable");
  } catch {
    return creationProblem("unavailable");
  }
}
