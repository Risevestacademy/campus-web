import type { ApiClient } from "@/core/api/client";

import {
  parseCampusMaps,
  parseMapProblems,
  parseSpacePage,
  parseSyncResult,
  parseUnavailableReason,
} from "../schemas/maps.schema";
import type {
  EntryMapRead,
  MapPublishOutcome,
  MapPublishProblem,
  MapSyncOutcome,
  MapSyncProblem,
  SpaceChanges,
  SpaceSettings,
  SpacesRead,
  SpaceUpdateOutcome,
  SpaceUpdateProblem,
} from "../types/maps.types";

const SPACES_PER_PAGE = 100;
// A map draws tens of spaces. The cap keeps a bad `totalPages` from
// turning one page load into thousands of requests.
const MAX_SPACE_PAGES = 20;

// Only the entry map can be published, and a retired map is listed too, so
// the entry map is the live one campus-api marks as the entry.
export async function readEntryMap(api: ApiClient): Promise<EntryMapRead> {
  try {
    const { data, response } = await api.GET("/v1/maps");
    const maps = response.ok ? parseCampusMaps(data) : undefined;
    if (!maps) return { kind: "unavailable" };

    const entry = maps.find(
      ({ isEntry, retiredAt }) => isEntry && retiredAt === null,
    );
    return {
      kind: "loaded",
      map: entry
        ? {
            id: entry.id,
            key: entry.key,
            name: entry.name,
            syncedVersion: entry.syncedVersion,
            publishedVersion: entry.publishedVersion,
          }
        : null,
    };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function listSpaces(
  api: ApiClient,
  mapId: string,
): Promise<SpacesRead> {
  const spaces: SpaceSettings[] = [];

  try {
    for (let page = 1; page <= MAX_SPACE_PAGES; page += 1) {
      const { data, response } = await api.GET("/v1/spaces", {
        params: { query: { mapId, page, perPage: SPACES_PER_PAGE } },
      });
      const parsed = response.ok ? parseSpacePage(data) : undefined;
      if (!parsed) return { kind: "unavailable" };

      spaces.push(...parsed.spaces);
      if (page >= parsed.totalPages) return { kind: "loaded", spaces };
    }
  } catch {
    return { kind: "unavailable" };
  }

  return { kind: "unavailable" };
}

const updateProblems: Record<number, SpaceUpdateProblem> = {
  400: "invalid",
  401: "signed-out",
  403: "forbidden",
  404: "missing",
  409: "kind-taken",
};

export async function updateSpace(
  api: ApiClient,
  id: string,
  changes: SpaceChanges,
): Promise<SpaceUpdateOutcome> {
  try {
    const { response } = await api.PATCH("/v1/spaces/{id}", {
      params: { path: { id } },
      body: {
        ...("name" in changes ? { name: changes.name } : {}),
        ...("kind" in changes ? { kind: changes.kind } : {}),
        ...("access" in changes ? { access: changes.access } : {}),
        ...("audioMode" in changes ? { audioMode: changes.audioMode } : {}),
        ...("capacity" in changes ? { capacity: changes.capacity } : {}),
      },
    });
    return response.ok
      ? { kind: "updated" }
      : {
          kind: "problem",
          problem: updateProblems[response.status] ?? "unavailable",
        };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}

function syncProblem(problem: MapSyncProblem): MapSyncOutcome {
  return { kind: "problem", problem, mapProblems: [] };
}

export async function syncMaps(
  api: ApiClient,
  { dryRun }: { dryRun: boolean },
): Promise<MapSyncOutcome> {
  try {
    const { data, error, response } = await api.POST("/v1/maps/sync", {
      params: { query: { dryRun } },
    });

    if (response.ok) {
      const result = parseSyncResult(data);
      return result ? { kind: "synced", result } : syncProblem("unavailable");
    }

    switch (response.status) {
      case 400:
        return syncProblem("invalid");
      case 401:
        return syncProblem("signed-out");
      case 403:
        return syncProblem("forbidden");
      case 409: {
        const mapProblems = parseMapProblems(error);
        return mapProblems
          ? { kind: "problem", problem: "rejected", mapProblems }
          : syncProblem("busy");
      }
      case 503: {
        const reason = parseUnavailableReason(error);
        return syncProblem(
          reason === "not_configured"
            ? "not-configured"
            : reason === "unreachable"
              ? "sanity-unreachable"
              : "unavailable",
        );
      }
      default:
        return syncProblem("unavailable");
    }
  } catch {
    return syncProblem("unavailable");
  }
}

const publishProblems: Record<number, MapPublishProblem> = {
  400: "invalid",
  401: "signed-out",
  403: "forbidden",
  404: "missing",
  409: "refused",
};

export async function publishMap(
  api: ApiClient,
  mapId: string,
): Promise<MapPublishOutcome> {
  try {
    const { response } = await api.POST("/v1/maps/{id}/publish", {
      params: { path: { id: mapId } },
    });
    return response.ok
      ? { kind: "published" }
      : {
          kind: "problem",
          problem: publishProblems[response.status] ?? "unavailable",
        };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
