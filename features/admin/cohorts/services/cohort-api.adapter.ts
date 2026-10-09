import type { ApiClient } from "@/core/api/client";

import { parseCohortList } from "../schemas/cohort.schema";
import type {
  CohortCreation,
  CohortCreationProblem,
  CohortDeletion,
  CohortEdit,
  CohortListRead,
  CohortMutationProblem,
  CohortPatch,
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
  403: "forbidden",
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

const MUTATION_PROBLEMS: Readonly<
  Partial<Record<number, CohortMutationProblem>>
> = {
  400: "invalid",
  401: "signed-out",
  403: "forbidden",
  404: "missing",
  409: "conflict",
};

function mutationProblem(status: number): CohortMutationProblem {
  return MUTATION_PROBLEMS[status] ?? "unavailable";
}

export async function editCohort(
  api: ApiClient,
  id: string,
  changes: CohortPatch,
): Promise<CohortEdit> {
  try {
    const { response } = await api.PATCH("/v1/cohorts/{id}", {
      params: { path: { id } },
      body: changes,
    });
    return response.ok
      ? { kind: "updated" }
      : { kind: "problem", problem: mutationProblem(response.status) };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}

export async function deleteCohort(
  api: ApiClient,
  id: string,
): Promise<CohortDeletion> {
  try {
    const { response } = await api.DELETE("/v1/cohorts/{id}", {
      params: { path: { id } },
    });
    return response.ok
      ? { kind: "deleted" }
      : { kind: "problem", problem: mutationProblem(response.status) };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
