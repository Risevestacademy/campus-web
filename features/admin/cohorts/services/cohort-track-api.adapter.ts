import type { ApiClient } from "@/core/api/client";

import { parseCohortTrackCollection } from "../schemas/cohort-track.schema";
import type {
  CohortTrackAttachment,
  CohortTrackDetachment,
  CohortTrackRead,
  CohortTrackRecordProblem,
} from "../types/cohort-track.types";

export async function readCohortTracks(
  api: ApiClient,
  cohortId: string,
): Promise<CohortTrackRead> {
  try {
    const { data, response } = await api.GET("/v1/cohorts/{id}", {
      params: { path: { id: cohortId } },
    });
    if (response.status === 404) return { kind: "missing" };
    if (!response.ok) return { kind: "unavailable" };

    const collection = parseCohortTrackCollection(data);
    return collection
      ? { kind: "loaded", ...collection }
      : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

const COMMON_PROBLEMS: Readonly<
  Partial<Record<number, CohortTrackRecordProblem>>
> = {
  400: "invalid",
  401: "signed-out",
  403: "forbidden",
  404: "missing",
};

function commonProblem(status: number): CohortTrackRecordProblem {
  return COMMON_PROBLEMS[status] ?? "unavailable";
}

export async function attachCohortTrack(
  api: ApiClient,
  cohortId: string,
  trackId: string,
): Promise<CohortTrackAttachment> {
  try {
    const { response } = await api.POST("/v1/cohorts/{id}/tracks", {
      params: { path: { id: cohortId } },
      body: { trackId },
    });
    if (response.ok) return { kind: "attached" };

    return {
      kind: "problem",
      problem:
        response.status === 409
          ? "already-attached"
          : commonProblem(response.status),
    };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}

export async function detachCohortTrack(
  api: ApiClient,
  cohortId: string,
  trackId: string,
): Promise<CohortTrackDetachment> {
  try {
    const { response } = await api.DELETE("/v1/cohorts/{id}/tracks/{trackId}", {
      params: { path: { id: cohortId, trackId } },
    });
    if (response.ok) return { kind: "detached" };

    return {
      kind: "problem",
      problem:
        response.status === 409 ? "in-use" : commonProblem(response.status),
    };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
