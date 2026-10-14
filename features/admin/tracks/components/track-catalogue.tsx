import "server-only";

import { getServerApi } from "@/core/api/client/server";

import {
  CataloguePagination,
  CatalogueUnavailable,
} from "../../catalogue/catalogue-presentation";
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
export async function TrackCatalogue({ page }: { page: number }) {
  const result = await listTracks(await getServerApi(), page);
  return (
    <section aria-labelledby="track-catalogue-heading" className="grid gap-6">
      <h2 id="track-catalogue-heading" className="text-lg font-medium">
        Programme Tracks
      </h2>
      {result.kind === "unavailable" ? (
        <CatalogueUnavailable retryHref={`/campus?view=tracks&page=${page}`}>
          We couldn&apos;t load the Programme Tracks.
        </CatalogueUnavailable>
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
          <CataloguePagination
            ariaLabel="Programme Track pages"
            hrefForPage={href}
            page={result.page}
            totalPages={result.totalPages}
          />
        </div>
      )}
    </section>
  );
}
