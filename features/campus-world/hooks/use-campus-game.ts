"use client";

import { useCallback, useState } from "react";

import { ANALYTICS_EVENTS } from "@/core/analytics/events";

import type { CampusGame } from "../game/campus-runtime";
import { failureEventProperties } from "../services/map/campus-map-error";
import { ENTRY_MAP } from "../services/map/load-campus-map";
import type { PreparedCampusMap } from "../services/map/prepare-campus-map";
import { startTimer } from "../services/timer";
import {
  type CampusWorldStatus,
  type CampusWorldStore,
  createCampusWorldStore,
} from "../store/campus-world-store";
import type { CampusWorldDependencies } from "./campus-world-dependencies";
import { useCachedCampusMap } from "./use-campus-map-preparation";
import { useCampusWorldStatus } from "./use-campus-world-status";

function mountCampusGame(
  container: HTMLElement,
  prepared: PreparedCampusMap,
  store: CampusWorldStore,
  dependencies: CampusWorldDependencies,
): () => void {
  const { mapId, version } = prepared.manifest;
  const attempt = store.getState().begin();
  const timer = startTimer(dependencies.now);
  const lifetime = new AbortController();
  let game: CampusGame | undefined;

  function failRender() {
    if (!store.getState().fail(attempt, mapId)) return;

    dependencies.captureEvent?.(
      ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_FAILED,
      failureEventProperties({ errorKind: "render", mapId }),
    );
  }

  void dependencies.runtime
    .start(container, prepared, {
      onRenderError: failRender,
      signal: lifetime.signal,
    })
    .then(
      (startedGame) => {
        if (lifetime.signal.aborted) {
          startedGame.stop();
          return;
        }

        game = startedGame;
        store.getState().ready(attempt, mapId);
        dependencies.captureEvent?.(ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_READY, {
          first_frame_ms: timer.elapsedMs(),
          map_id: mapId,
          version,
        });
      },
      () => {
        if (!lifetime.signal.aborted) failRender();
      },
    );

  return () => {
    lifetime.abort();
    game?.stop();
  };
}

export function useCampusGame(dependencies: CampusWorldDependencies) {
  const [store] = useState(createCampusWorldStore);
  const [mountVersion, setMountVersion] = useState(0);
  const state = useCampusWorldStatus(store);
  const preparation = useCachedCampusMap(ENTRY_MAP, dependencies);
  const prepared = preparation.isFetching ? undefined : preparation.data;

  const mountGame = useCallback(
    (container: HTMLDivElement | null) => {
      if (!container || !prepared) return;
      return mountCampusGame(container, prepared, store, dependencies);
    },
    [dependencies, prepared, store],
  );

  function retry() {
    if (preparation.isError) {
      void preparation.refetch();
      return;
    }

    setMountVersion((version) => version + 1);
  }

  const status: CampusWorldStatus = preparation.isError
    ? "failed"
    : prepared
      ? state.status
      : "loading-map";

  return { mapId: state.mapId, mountGame, mountVersion, retry, status };
}
