import "server-only";

import { cn } from "cn";
import Link from "next/link";

import { getServerApi } from "@/core/api/client/server";
import { buttonVariants } from "@/shared/ui/button";

import { listTracks } from "../services/track-api.adapter";
import type { TrackSummary } from "../types/track.types";
import { CreateTrackTile } from "./create-track-tile";
import { TrackAdministrationCard } from "./track-administration-card";
const EMPTY = "No Programme Tracks yet. Create the first Programme Track.";
function href(page: number) {
  return {
    pathname: "/campus",
    query: { view: "tracks", page: String(page) },
  } as const;
}
export async function TrackCatalogue({
  page,
}: {
  page: string | number | undefined;
}) {
  const requested =
    typeof page === "number" ? page : Number(page) > 0 ? Number(page) : 1;
  const result = await listTracks(await getServerApi(), requested);
  return (
    <section aria-labelledby="track-catalogue-heading" className="grid gap-6">
      <h2 id="track-catalogue-heading" className="text-lg font-medium">
        Programme Tracks
      </h2>
      {result.kind === "unavailable" ? (
        <div className="grid justify-items-start gap-4">
          <p role="alert">We couldn&apos;t load the Programme Tracks.</p>
          <a
            className={cn(buttonVariants({ variant: "outline" }))}
            href={`/campus?view=tracks&page=${requested}`}
          >
            Try again
          </a>
        </div>
      ) : (
        <div className="grid gap-8">
          {result.tracks.length === 0 ? (
            <p className="text-foreground-secondary">{EMPTY}</p>
          ) : null}
          <ul className="flex flex-wrap gap-8">
            <li>
              <CreateTrackTile />
            </li>
            {result.tracks.map((track: TrackSummary) => (
              <li key={track.id}>
                <TrackAdministrationCard track={track} />
              </li>
            ))}
          </ul>
          {result.totalPages > 1 ? (
            <nav
              aria-label="Programme Track pages"
              className="flex items-center gap-4"
            >
              {result.page > 1 ? (
                <Link
                  href={href(result.page - 1)}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Previous page
                </Link>
              ) : null}
              <span>
                Page {result.page} of {result.totalPages}
              </span>
              {result.page < result.totalPages ? (
                <Link
                  href={href(result.page + 1)}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Next page
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      )}
    </section>
  );
}
