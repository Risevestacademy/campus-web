import type { ApiClient } from "@/core/api/client";

import { parseTrackList } from "../schemas/track.schema";
import type {
  NewTrack,
  TrackCreation,
  TrackCreationProblem,
  TrackDeletion,
  TrackEdit,
  TrackListRead,
  TrackPatch,
  TrackRecordProblem,
} from "../types/track.types";

export async function listTracks(
  api: ApiClient,
  page: number,
): Promise<TrackListRead> {
  try {
    const { data, response } = await api.GET("/v1/tracks", {
      params: { query: { page } },
    });
    const parsed = response.ok ? parseTrackList(data) : undefined;
    return parsed ? { kind: "loaded", ...parsed } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
const createProblems: Record<number, TrackCreationProblem> = {
  400: "rejected",
  401: "signed-out",
  403: "forbidden",
  409: "duplicate-code",
};
export async function createTrack(
  api: ApiClient,
  track: NewTrack,
): Promise<TrackCreation> {
  try {
    const { response } = await api.POST("/v1/tracks", { body: track });
    return response.ok
      ? { kind: "created" }
      : {
          kind: "problem",
          problem: createProblems[response.status] ?? "unavailable",
        };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
const recordProblems: Record<number, TrackRecordProblem> = {
  400: "invalid",
  401: "signed-out",
  403: "forbidden",
  404: "missing",
};

function recordProblem(status: number): TrackRecordProblem {
  return recordProblems[status] ?? "unavailable";
}

export async function editTrack(
  api: ApiClient,
  id: string,
  changes: TrackPatch,
): Promise<TrackEdit> {
  try {
    const { response } = await api.PATCH("/v1/tracks/{id}", {
      params: { path: { id } },
      body: changes,
    });
    return response.ok
      ? { kind: "updated" }
      : {
          kind: "problem",
          problem:
            response.status === 409
              ? "duplicate-code"
              : recordProblem(response.status),
        };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
export async function deleteTrack(
  api: ApiClient,
  id: string,
): Promise<TrackDeletion> {
  try {
    const { response } = await api.DELETE("/v1/tracks/{id}", {
      params: { path: { id } },
    });
    return response.ok
      ? { kind: "deleted" }
      : {
          kind: "problem",
          problem:
            response.status === 409
              ? "attached"
              : recordProblem(response.status),
        };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
