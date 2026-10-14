"use client";

import { type ReactNode, useState } from "react";
import { preconnect } from "react-dom";

import { Button } from "@/shared/ui/button";

import {
  type CampusWorldDependencies,
  defaultCampusWorldDependencies,
} from "../hooks/campus-world-dependencies";
import { useCampusMapPreparation } from "../hooks/use-campus-map-preparation";
import { ENTRY_MAP, sanityMapOrigins } from "../services/map/load-campus-map";
import type { CampusMapPreparationProgress } from "../services/map/prepare-campus-map";

const initialProgress: CampusMapPreparationProgress = { stage: "manifest" };

type PreparationPhase = "failed" | "preparing" | "ready";

function preparationPhase(
  query: { isFetching: boolean; isPending: boolean; isSuccess: boolean },
  isRenderReady: boolean,
): PreparationPhase {
  if (query.isFetching || query.isPending) return "preparing";
  if (!query.isSuccess) return "failed";
  return isRenderReady ? "ready" : "preparing";
}

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

function artworkProgressOf(
  progress: CampusMapPreparationProgress,
): { completed: number; total: number } | undefined {
  switch (progress.stage) {
    case "tilesets":
      return progress;
    case "runtime":
      return { completed: progress.total, total: progress.total };
    default:
      return undefined;
  }
}

function PreparingCampus({
  progress,
}: {
  progress: CampusMapPreparationProgress;
}) {
  const artworkProgress = artworkProgressOf(progress);
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

        <div
          aria-label="Campus artwork"
          aria-valuemax={artworkProgress?.total}
          aria-valuemin={0}
          aria-valuenow={artworkProgress?.completed}
          className="bg-cobalt-800 mt-6 h-1.5 overflow-hidden rounded-full"
          role="progressbar"
        >
          <div
            className="bg-accent h-full origin-left transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
            style={{ transform: `scaleX(${artworkScale})` }}
          />
        </div>
      </div>
    </main>
  );
}

function PreparationFailed({ onRetry }: { onRetry: () => void }) {
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
        <Button className="mt-6 min-w-32" type="button" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </main>
  );
}

interface CampusMapPreparationGateProps {
  children: ReactNode;
  dependencies?: CampusWorldDependencies;
}

export function CampusMapPreparationGate({
  children,
  dependencies = defaultCampusWorldDependencies,
}: CampusMapPreparationGateProps) {
  // Map requests are CORS fetches; only an anonymous preconnect is reusable.
  sanityMapOrigins(dependencies.configuration.projectId).forEach((origin) =>
    preconnect(origin, { crossOrigin: "anonymous" }),
  );

  const [progress, setProgress] = useState(initialProgress);
  const { isRenderReady, preparation } = useCampusMapPreparation(
    ENTRY_MAP,
    dependencies,
    setProgress,
  );
  const phase = preparationPhase(preparation, isRenderReady);
  const [beganWithPendingPreparation] = useState(phase !== "ready");

  switch (phase) {
    case "ready":
      return beganWithPendingPreparation ? (
        <div className="animate-in fade-in duration-200 motion-reduce:animate-none">
          {children}
        </div>
      ) : (
        children
      );
    case "preparing":
      return <PreparingCampus progress={progress} />;
    case "failed":
      return (
        <PreparationFailed
          onRetry={() => {
            setProgress(initialProgress);
            void preparation.refetch();
          }}
        />
      );
  }
}
