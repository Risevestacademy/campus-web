"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";

import { prepareCampusWorldMap } from "../services/map/campus-map-preparation.service";
import type { MapSource } from "../services/map/load-campus-map";
import {
  type CampusMapPreparationProgress,
  isPreparedCampusMapRenderReady,
} from "../services/map/prepare-campus-map";
import type { CampusMapDependencies } from "./campus-world-dependencies";

export function campusMapPreparationQueryKey(
  configuration: CampusMapDependencies["configuration"],
  source: MapSource,
) {
  return [
    "campus-map",
    "prepared",
    configuration.projectId ?? null,
    configuration.dataset ?? null,
    source.kind,
    source.kind === "pinned" ? source.mapId : null,
    source.kind === "pinned" ? source.version : null,
  ] as const;
}

function campusMapPreparationQueryOptions(
  source: MapSource,
  dependencies: CampusMapDependencies,
  onProgress?: (progress: CampusMapPreparationProgress) => void,
) {
  return queryOptions({
    gcTime: Number.POSITIVE_INFINITY,
    queryKey: campusMapPreparationQueryKey(dependencies.configuration, source),
    queryFn: ({ signal }) =>
      prepareCampusWorldMap(source, dependencies, { onProgress, signal }),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
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
  source: MapSource,
  dependencies: CampusMapDependencies,
) {
  return useQuery({
    ...campusMapPreparationQueryOptions(source, dependencies),
    // The world takes the decoded images during commit, before this observer
    // subscribes. Refetching here would restart the game.
    refetchOnMount: false,
  });
}
