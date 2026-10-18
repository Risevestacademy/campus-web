"use client";

import { useCallback, useState } from "react";
import { useStore } from "zustand";

import { ANALYTICS_EVENTS } from "@/core/analytics/events";
import type { PresenceStore } from "@/core/presence";

import type { CampusGame } from "../game/campus-runtime";
import { failureEventProperties } from "../services/map/campus-map-error";
import { mapSourceFromSnapshot } from "../services/map/load-campus-map";
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

interface CampusGameMount {
  dependencies: CampusWorldDependencies;
  presence: PresenceStore;
  prepared: PreparedCampusMap;
  store: CampusWorldStore;
}

function mountCampusGame(
  container: HTMLElement,
  { dependencies, presence, prepared, store }: CampusGameMount,
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
      readPresence: presence.getState,
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

export function useCampusGame(
  dependencies: CampusWorldDependencies,
  cohortId: string,
) {
  const [store] = useState(createCampusWorldStore);
  const [presence] = useState(() => dependencies.presence(cohortId));
  const [mountVersion, setMountVersion] = useState(0);
  const state = useCampusWorldStatus(store);
  const worldMap = useStore(presence, (current) => current.map);
  const source = worldMap ? mapSourceFromSnapshot(worldMap) : undefined;
  const preparation = useCachedCampusMap(source, dependencies);
  const prepared = preparation.isFetching ? undefined : preparation.data;

  const mountGame = useCallback(
    (container: HTMLDivElement | null) => {
      if (!container || !prepared) return;
      return mountCampusGame(container, {
        dependencies,
        presence,
        prepared,
        store,
      });
    },
    [dependencies, presence, prepared, store],
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
