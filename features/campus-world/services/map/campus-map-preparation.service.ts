import {
  ANALYTICS_EVENTS,
  type AnalyticsEventMap,
  type CampusWorldMapLoadedProperties,
} from "@/core/analytics/events";

import {
  CampusMapError,
  campusMapFailureOf,
  failureEventProperties,
} from "./campus-map-error";
import type { MapSource } from "./load-campus-map";
import {
  type CampusMapModule,
  type CampusMapPreparationProgress,
  loadDecodedCampusMapImage,
  prepareCampusMap,
  type PrepareCampusMapDependencies,
  type PreparedCampusMap,
} from "./prepare-campus-map";

type CampusWorldEventName =
  | typeof ANALYTICS_EVENTS.CAMPUS_WORLD_CAMERA_ZOOMED
  | typeof ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_FAILED
  | typeof ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_LOADED
  | typeof ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_READY
  | typeof ANALYTICS_EVENTS.CAMPUS_WORLD_MOVE_CORRECTED;

export type CampusWorldCapture = <EventName extends CampusWorldEventName>(
  eventName: EventName,
  properties: AnalyticsEventMap[EventName],
) => void;

export interface CampusMapPreparationDependencies {
  captureEvent?: CampusWorldCapture;
  configuration: {
    dataset?: string;
    projectId?: string;
  };
  fetch?: typeof globalThis.fetch;
  loadImage?: (url: string, signal: AbortSignal) => Promise<ImageBitmap>;
  loadKaplay?: () => Promise<CampusMapModule>;
  now?: () => number;
}

interface PreparationRequest {
  onProgress?: (progress: CampusMapPreparationProgress) => void;
  signal: AbortSignal;
}

function loadedEventProperties(
  prepared: PreparedCampusMap,
): CampusWorldMapLoadedProperties {
  return {
    load_ms: prepared.preparationMs,
    map_id: prepared.manifest.mapId,
    tilesets: prepared.tilesets.length,
    version: prepared.manifest.version,
  };
}

function withDefaults(
  dependencies: CampusMapPreparationDependencies,
  { onProgress, signal }: PreparationRequest,
): PrepareCampusMapDependencies {
  const { dataset, projectId } = dependencies.configuration;

  if (!dataset || !projectId) {
    throw new CampusMapError(
      "config",
      "Public Sanity configuration is unavailable.",
    );
  }

  const fetch = dependencies.fetch ?? globalThis.fetch.bind(globalThis);

  return {
    dataset,
    fetch,
    loadImage:
      dependencies.loadImage ??
      ((url, imageSignal) =>
        loadDecodedCampusMapImage(url, { fetch, signal: imageSignal })),
    loadKaplay: dependencies.loadKaplay ?? (() => import("kaplay")),
    now: dependencies.now,
    onProgress,
    projectId,
    signal,
  };
}

export async function prepareCampusWorldMap(
  source: MapSource,
  dependencies: CampusMapPreparationDependencies,
  request: PreparationRequest,
): Promise<PreparedCampusMap> {
  const captureEvent = dependencies.captureEvent ?? (() => undefined);

  try {
    const prepared = await prepareCampusMap(
      source,
      withDefaults(dependencies, request),
    );
    captureEvent(
      ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_LOADED,
      loadedEventProperties(prepared),
    );
    return prepared;
  } catch (error) {
    request.signal.throwIfAborted();
    captureEvent(
      ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_FAILED,
      failureEventProperties(campusMapFailureOf(error)),
    );
    throw error;
  }
}
