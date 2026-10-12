"use client";

import { useCallback, useState } from "react";

import { ANALYTICS_EVENTS } from "@/core/analytics/events";
import { Button } from "@/shared/ui/button";

import type { StartCampusGame } from "../game/campus-game.types";
import { startCampusGame } from "../game/start-campus-game";
import { useCampusWorldStatus } from "../hooks/use-campus-world-status";
import {
  type CampusMapPreparationDependencies,
  defaultCampusMapPreparationDependencies,
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
  ...defaultCampusMapPreparationDependencies,
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
        const failed = store
          .getState()
          .fail(attempt, { errorKind: "render", mapId });
        if (!failed) return;

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
  const isStarting = status === "loading-map" || status === "idle";

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
      <div
        aria-hidden={isStarting ? undefined : true}
        className="bg-cobalt-950 text-foreground-inverse pointer-events-none absolute inset-0 z-10 grid place-items-center text-sm transition-opacity duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] data-[state=closed]:opacity-0"
        data-state={isStarting ? "open" : "closed"}
      >
        <p
          aria-label="Starting campus"
          className="animate-in fade-in fill-mode-both delay-300 duration-200 motion-reduce:animate-none"
          role="status"
        >
          Starting your campus…
        </p>
      </div>
      {status === "failed" ? (
        <div
          className="bg-background/95 absolute inset-0 z-10 grid place-content-center gap-3 text-center"
          role="alert"
        >
          <p>We couldn&apos;t load the campus map.</p>
          <Button
            className="mx-auto"
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
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function CampusWorld(props: CampusWorldProps) {
  return <CampusWorldHarness {...props} dependencies={defaultDependencies} />;
}
