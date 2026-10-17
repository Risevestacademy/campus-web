"use client";

import { Button } from "@/shared/ui/button";

import {
  type CampusWorldDependencies,
  defaultCampusWorldDependencies,
} from "../hooks/campus-world-dependencies";
import { useCampusGame } from "../hooks/use-campus-game";

interface CampusWorldProps {
  cohortId: string;
  dependencies?: CampusWorldDependencies;
}

export function CampusWorld({
  cohortId,
  dependencies = defaultCampusWorldDependencies,
}: CampusWorldProps) {
  const { mapId, mountGame, mountVersion, retry, status } = useCampusGame(
    dependencies,
    cohortId,
  );
  const isStarting = status === "loading-map" || status === "idle";

  return (
    <div
      key={mountVersion}
      ref={mountGame}
      aria-label="Campus map"
      className="bg-cobalt-950 relative size-full overflow-hidden"
      data-cohort-id={cohortId}
      data-map-id={mapId ?? undefined}
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
          <Button className="mx-auto" type="button" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
