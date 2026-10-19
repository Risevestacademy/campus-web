"use client";

import {
  type QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { prepareCampusWorldMap } from "../services/map/campus-map-preparation.service";
import { ENTRY_MAP, type MapSource } from "../services/map/load-campus-map";
import {
  type CampusMapPreparationProgress,
  isPreparedCampusMapRenderReady,
  type PreparedCampusMap,
} from "../services/map/prepare-campus-map";
import type { CampusMapDependencies } from "./campus-world-dependencies";

export function campusMapPreparationQueryKey(
  configuration: CampusMapDependencies["configuration"],
  source: MapSource | undefined,
) {
  return [
    "campus-map",
    "prepared",
    configuration.projectId ?? null,
    configuration.dataset ?? null,
    source?.kind ?? null,
    source?.kind === "pinned" ? source.mapId : null,
    source?.kind === "pinned" ? source.version : null,
    source && source.kind !== "entry" ? source.width : null,
    source && source.kind !== "entry" ? source.height : null,
  ] as const;
}

function campusMapPreparationQueryOptions(
  source: MapSource | undefined,
  dependencies: CampusMapDependencies,
  onProgress?: (progress: CampusMapPreparationProgress) => void,
) {
  return queryOptions({
    gcTime: Number.POSITIVE_INFINITY,
    queryKey: campusMapPreparationQueryKey(dependencies.configuration, source),
    enabled: source !== undefined,
    queryFn: ({ signal }) => {
      if (!source) throw new Error("A world map snapshot is required.");
      return prepareCampusWorldMap(source, dependencies, {
        onProgress,
        signal,
      });
    },
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

function preparedEntryForSnapshot(
  source: MapSource | undefined,
  dependencies: CampusMapDependencies,
  queryClient: QueryClient,
): PreparedCampusMap | undefined {
  if (source?.kind !== "pinned") return undefined;
  const prepared = queryClient.getQueryData<PreparedCampusMap>(
    campusMapPreparationQueryKey(dependencies.configuration, ENTRY_MAP),
  );
  if (!prepared) return undefined;
  return matchesSnapshot(prepared, source) ? prepared : undefined;
}

function matchesSnapshot(
  prepared: PreparedCampusMap,
  source: Extract<MapSource, { kind: "pinned" }>,
) {
  const { manifest } = prepared;
  return (
    manifest.mapId === source.mapId &&
    manifest.version === source.version &&
    manifest.widthTiles === source.width &&
    manifest.heightTiles === source.height
  );
}

export function useCampusMapPreparation(
  source: MapSource,
  dependencies: CampusMapDependencies,
  onProgress?: (progress: CampusMapPreparationProgress) => void,
) {
  const preparation = useQuery({
    ...campusMapPreparationQueryOptions(source, dependencies, onProgress),
    refetchOnMount: (query) => {
      const prepared = query.state.data;

      return prepared &&
        !isPreparedCampusMapRenderReady(prepared, dependencies.runtime.holdsMap)
        ? "always"
        : false;
    },
  });
  const isRenderReady =
    preparation.data !== undefined &&
    isPreparedCampusMapRenderReady(
      preparation.data,
      dependencies.runtime.holdsMap,
    );

  return { isRenderReady, preparation };
}

export function useCachedCampusMap(
  source: MapSource | undefined,
  dependencies: CampusMapDependencies,
) {
  const queryClient = useQueryClient();
  return useQuery({
    ...campusMapPreparationQueryOptions(source, dependencies),
    initialData: () =>
      preparedEntryForSnapshot(source, dependencies, queryClient),
    // The world takes the decoded images during commit, before this observer
    // subscribes. Refetching here would restart the game.
    refetchOnMount: false,
  });
}
