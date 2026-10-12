"use client";

import {
  type QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { publicEnvironment } from "@/config/environment/public";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import {
  ANALYTICS_EVENTS,
  type AnalyticsEventMap,
  type CampusWorldMapErrorKind,
} from "@/core/analytics/events";

import {
  CampusMapLoadError,
  type MapSource,
} from "../services/map/load-campus-map";
import type { CampusMapModule } from "../services/map/prepare-campus-map";
import {
  CampusMapPreparationError,
  type CampusMapPreparationProgress,
  isPreparedCampusMapRenderReady,
  loadDecodedCampusMapImage,
  prepareCampusMap,
  type PreparedCampusMap,
  rehydratePreparedCampusMap,
} from "../services/map/prepare-campus-map";

type PreparationEventName =
  | typeof ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_FAILED
  | typeof ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_LOADED
  | typeof ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_REHYDRATED
  | typeof ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_REHYDRATION_FAILED;

type PreparationCapture = <EventName extends PreparationEventName>(
  eventName: EventName,
  properties: AnalyticsEventMap[EventName],
) => void;

export interface CampusMapPreparationDependencies {
  captureEvent?: PreparationCapture;
  configuration: {
    dataset?: string;
    projectId?: string;
  };
  fetch?: typeof globalThis.fetch;
  loadImage?: (url: string, signal: AbortSignal) => Promise<ImageBitmap>;
  loadKaplay?: () => Promise<CampusMapModule>;
  now?: () => number;
}

export const defaultCampusMapPreparationDependencies: CampusMapPreparationDependencies =
  {
    captureEvent: captureBrowserAnalyticsEvent,
    configuration: {
      dataset: publicEnvironment.NEXT_PUBLIC_SANITY_DATASET,
      projectId: publicEnvironment.NEXT_PUBLIC_SANITY_PROJECT_ID,
    },
  };

function preparedEventProperties(prepared: PreparedCampusMap) {
  return {
    load_ms: prepared.preparationMs,
    map_id: prepared.manifest.mapId,
    tilesets: prepared.tilesets.length,
    version: prepared.manifest.version,
  };
}

function failureFrom(error: unknown): {
  errorKind: CampusWorldMapErrorKind;
  mapId: string | null;
} {
  if (
    error instanceof CampusMapLoadError ||
    error instanceof CampusMapPreparationError
  ) {
    return { errorKind: error.kind, mapId: error.mapId };
  }

  return { errorKind: "render", mapId: null };
}

export function campusMapPreparationQueryKey(
  configuration: CampusMapPreparationDependencies["configuration"],
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

export function campusMapPreparationQueryOptions(
  source: MapSource,
  dependencies: CampusMapPreparationDependencies,
  queryClient: QueryClient,
  onProgress?: (progress: CampusMapPreparationProgress) => void,
) {
  const queryKey = campusMapPreparationQueryKey(
    dependencies.configuration,
    source,
  );

  return queryOptions({
    gcTime: Number.POSITIVE_INFINITY,
    queryKey,
    queryFn: async ({ signal }) => {
      const { dataset, projectId } = dependencies.configuration;
      const captureEvent = dependencies.captureEvent ?? (() => undefined);
      const cached = queryClient.getQueryData<PreparedCampusMap>(queryKey);
      const needsRehydration =
        cached !== undefined && !isPreparedCampusMapRenderReady(cached);

      try {
        const fetchImplementation =
          dependencies.fetch ?? globalThis.fetch.bind(globalThis);
        const loadImage =
          dependencies.loadImage ??
          ((url: string, imageSignal: AbortSignal) =>
            loadDecodedCampusMapImage(url, {
              fetch: fetchImplementation,
              signal: imageSignal,
            }));

        if (needsRehydration) {
          const rehydrated = await rehydratePreparedCampusMap(cached, {
            loadImage,
            now: dependencies.now,
            onProgress,
            signal,
          });

          captureEvent(
            ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_REHYDRATED,
            preparedEventProperties(rehydrated),
          );
          return rehydrated;
        }

        if (!dataset || !projectId) {
          throw new CampusMapPreparationError(
            "config",
            "Public Sanity configuration is unavailable.",
          );
        }

        const prepared = await prepareCampusMap(source, {
          dataset,
          fetch: fetchImplementation,
          loadImage,
          loadKaplay: dependencies.loadKaplay ?? (() => import("kaplay")),
          now: dependencies.now,
          onProgress,
          projectId,
          signal,
        });

        captureEvent(
          ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_LOADED,
          preparedEventProperties(prepared),
        );

        return prepared;
      } catch (error) {
        signal.throwIfAborted();
        const failure = failureFrom(error);
        captureEvent(
          needsRehydration
            ? ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_REHYDRATION_FAILED
            : ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_FAILED,
          {
            error_kind: failure.errorKind,
            map_id: failure.mapId,
          },
        );
        throw error;
      }
    },
    refetchOnMount: (query) => {
      const prepared = query.state.data;
      return prepared && !isPreparedCampusMapRenderReady(prepared)
        ? "always"
        : false;
    },
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function usePreparedCampusMap(
  source: MapSource,
  onProgress: ((progress: CampusMapPreparationProgress) => void) | undefined,
  dependencies: CampusMapPreparationDependencies,
) {
  const queryClient = useQueryClient();

  return useQuery(
    campusMapPreparationQueryOptions(
      source,
      dependencies,
      queryClient,
      onProgress,
    ),
  );
}

export function useCampusWorldMap(
  source: MapSource,
  dependencies: CampusMapPreparationDependencies,
) {
  const queryClient = useQueryClient();

  return useQuery({
    ...campusMapPreparationQueryOptions(source, dependencies, queryClient),
    // The world takes the decoded images during commit, before this observer
    // subscribes. Rehydrating here would refetch tilesets and restart the game.
    refetchOnMount: false,
  });
}
