"use client";

import { useCallback, useState } from "react";

import { publicEnvironment } from "@/config/environment/public";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import { ANALYTICS_EVENTS } from "@/core/analytics/events";

import type { StartCampusGame } from "../game/campus-game.types";
import { startCampusGame } from "../game/start-campus-game";
import { useCampusWorldStatus } from "../hooks/use-campus-world-status";
import {
  type CampusMapPreparationDependencies,
  useCampusWorldMap,
} from "../hooks/use-prepared-campus-map";
import { createCampusWorldStore } from "../store/campus-world-store";

export interface CampusWorldDependencies extends CampusMapPreparationDependencies {
  startGame: StartCampusGame;
}

interface CampusWorldProps {
  cohortId: string;
}

export interface CampusWorldHarnessProps extends CampusWorldProps {
  dependencies: CampusWorldDependencies;
}

const defaultDependencies: CampusWorldDependencies = {
  captureEvent: captureBrowserAnalyticsEvent,
  configuration: {
    dataset: publicEnvironment.NEXT_PUBLIC_SANITY_DATASET,
    projectId: publicEnvironment.NEXT_PUBLIC_SANITY_PROJECT_ID,
  },
  startGame: startCampusGame,
};

export function CampusWorldHarness({
  cohortId,
  dependencies,
}: CampusWorldHarnessProps) {
  const [store] = useState(createCampusWorldStore);
  const [mountVersion, setMountVersion] = useState(0);
  const state = useCampusWorldStatus(store);
  const preparation = useCampusWorldMap({ kind: "entry" }, dependencies);
  const prepared = preparation.isFetching ? undefined : preparation.data;

  const mountGame = useCallback(
    (container: HTMLDivElement | null) => {
      if (!container || !prepared) return;
      const preparedMap = prepared;

      const canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      container.append(canvas);

      const attempt = store.getState().begin();
      let disposed = false;
      let game: Awaited<ReturnType<StartCampusGame>> | undefined;

      function failRender() {
        const mapId = preparedMap.manifest.mapId;
        const before = store.getState();
        store.getState().fail(attempt, {
          errorKind: "render",
          mapId,
        });
        const after = store.getState();
        if (after === before || after.status !== "failed") return;

        dependencies.captureEvent?.(ANALYTICS_EVENTS.CAMPUS_WORLD_MAP_FAILED, {
          error_kind: "render",
          map_id: mapId,
        });
      }

      void dependencies
        .startGame(container, canvas, preparedMap, {
          onRenderError: failRender,
        })
        .then((startedGame) => {
          if (disposed) {
            startedGame.quit();
            return;
          }

          game = startedGame;
          store.getState().ready(attempt, preparedMap.manifest.mapId);
        })
        .catch(() => {
          if (!disposed) failRender();
        });

      return () => {
        disposed = true;
        game?.quit();
        canvas.remove();
      };
    },
    [dependencies, prepared, store],
  );

  const status = preparation.isError
    ? "failed"
    : prepared
      ? state.status
      : "loading-map";

  return (
    <div
      key={mountVersion}
      ref={mountGame}
      aria-label="Campus map"
      className="bg-cobalt-950 relative size-full overflow-hidden"
      data-cohort-id={cohortId}
      data-map-id={state.mapId ?? undefined}
      data-status={status}
      role="region"
    >
      {status === "loading-map" || status === "idle" ? (
        <p
          aria-label="Starting campus"
          className="bg-cobalt-950 text-foreground-inverse absolute inset-0 z-10 grid place-items-center text-sm"
          role="status"
        >
          Starting your campus…
        </p>
      ) : null}
      {status === "failed" ? (
        <div
          className="bg-background/95 absolute inset-0 z-10 grid place-content-center gap-3 text-center"
          role="alert"
        >
          <p>We couldn&apos;t load the campus map.</p>
          <button
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2"
            type="button"
            onClick={() => {
              if (preparation.isError) {
                void preparation.refetch();
                return;
              }

              setMountVersion((version) => version + 1);
            }}
          >
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CampusWorld(props: CampusWorldProps) {
  return <CampusWorldHarness {...props} dependencies={defaultDependencies} />;
}
