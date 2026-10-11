"use client";

import { type ReactNode, useState } from "react";

import { publicEnvironment } from "@/config/environment/public";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import { Button } from "@/shared/ui/button";

import {
  type CampusMapPreparationDependencies,
  usePreparedCampusMap,
} from "../hooks/use-prepared-campus-map";
import {
  type CampusMapPreparationProgress,
  isPreparedCampusMapRenderReady,
} from "../services/map/prepare-campus-map";

const initialProgress: CampusMapPreparationProgress = { stage: "manifest" };

function progressLabel(progress: CampusMapPreparationProgress): string {
  switch (progress.stage) {
    case "manifest":
      return "Finding your campus…";
    case "map":
      return "Reading the campus map…";
    case "tilesets":
      return `Loading campus artwork ${progress.completed} of ${progress.total}…`;
    case "runtime":
      return "Starting the campus…";
  }
}

interface CampusMapPreparationGateProps {
  children: ReactNode;
}

export interface CampusMapPreparationGateHarnessProps extends CampusMapPreparationGateProps {
  dependencies: CampusMapPreparationDependencies;
}

export function CampusMapPreparationGateHarness({
  children,
  dependencies,
}: CampusMapPreparationGateHarnessProps) {
  const [progress, setProgress] = useState(initialProgress);
  const preparation = usePreparedCampusMap(
    { kind: "entry" },
    setProgress,
    dependencies,
  );
  const isRenderReady =
    preparation.data !== undefined &&
    isPreparedCampusMapRenderReady(preparation.data);
  const [beganWithPendingPreparation] = useState(
    !preparation.isSuccess || !isRenderReady || preparation.isFetching,
  );

  if (preparation.isSuccess && isRenderReady && !preparation.isFetching) {
    return beganWithPendingPreparation ? (
      <div className="animate-in fade-in duration-200 motion-reduce:animate-none">
        {children}
      </div>
    ) : (
      children
    );
  }

  if (
    preparation.isFetching ||
    preparation.isPending ||
    (preparation.isSuccess && !isRenderReady)
  ) {
    const artworkProgress =
      progress.stage === "tilesets"
        ? progress
        : progress.stage === "runtime"
          ? { completed: progress.total, total: progress.total }
          : undefined;
    const artworkScale = artworkProgress
      ? artworkProgress.completed / Math.max(artworkProgress.total, 1)
      : 0;

    return (
      <main
        aria-label="Preparing campus"
        className="bg-cobalt-950 text-foreground-inverse grid h-dvh place-items-center px-6"
        role="status"
      >
        <div className="w-full max-w-sm text-center">
          <div
            aria-hidden="true"
            className="bg-accent text-accent-foreground mx-auto mb-8 grid size-14 place-items-center rounded-2xl text-xl font-semibold shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
          >
            C
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Preparing your campus
          </h1>
          <p className="text-cobalt-200 mt-2 text-sm">
            {progressLabel(progress)}
          </p>

          {artworkProgress ? (
            <div
              aria-label="Campus artwork"
              aria-valuemax={artworkProgress.total}
              aria-valuemin={0}
              aria-valuenow={artworkProgress.completed}
              className="bg-cobalt-800 mt-6 h-1.5 overflow-hidden rounded-full"
              role="progressbar"
            >
              <div
                className="bg-accent h-full origin-left rounded-full transition-transform duration-200 ease-out motion-reduce:transition-none"
                style={{ transform: `scaleX(${artworkScale})` }}
              />
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main
      className="bg-cobalt-950 text-foreground-inverse grid h-dvh place-items-center px-6 text-center"
      role="alert"
    >
      <div className="max-w-sm">
        <div
          aria-hidden="true"
          className="border-error-300 bg-error-950/40 text-error-300 mx-auto mb-6 grid size-12 place-items-center rounded-full border text-xl"
        >
          !
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          We couldn&apos;t prepare your campus.
        </h1>
        <p className="text-cobalt-200 mt-2 text-sm">
          Check your connection, then try again.
        </p>
        <Button
          className="mt-6 min-w-32"
          type="button"
          onClick={() => {
            setProgress(initialProgress);
            void preparation.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    </main>
  );
}

export function CampusMapPreparationGate({
  children,
}: CampusMapPreparationGateProps) {
  return (
    <CampusMapPreparationGateHarness
      dependencies={{
        captureEvent: captureBrowserAnalyticsEvent,
        configuration: {
          dataset: publicEnvironment.NEXT_PUBLIC_SANITY_DATASET,
          projectId: publicEnvironment.NEXT_PUBLIC_SANITY_PROJECT_ID,
        },
      }}
    >
      {children}
    </CampusMapPreparationGateHarness>
  );
}
