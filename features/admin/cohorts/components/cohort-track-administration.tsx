import "server-only";

import type { Route } from "next";
import Link from "next/link";

import { getServerApi } from "@/core/api/client/server";
import { buttonVariants } from "@/shared/ui/button";

import { listTracks } from "../../tracks/services/track-api.adapter";
import { parseChooserPage } from "../schemas/cohort.schema";
import { readCohortTracks } from "../services/cohort-track-api.adapter";
import {
  AttachCohortTrackForm,
  DetachCohortTrackDialog,
} from "./cohort-track-actions";

function pageHref(cohortId: string, page: number): Route {
  return `/campus/${encodeURIComponent(cohortId)}/tracks?page=${page}` as Route;
}

export async function CohortTrackAdministration({
  cohortId,
  page,
}: {
  cohortId: string;
  page: string | undefined;
}) {
  const requestedPage = parseChooserPage(page);
  const api = await getServerApi();
  const [cohortRead, catalogueRead] = await Promise.all([
    readCohortTracks(api, cohortId),
    listTracks(api, requestedPage),
  ]);

  if (cohortRead.kind === "missing") {
    return (
      <main className="grid gap-4 p-10">
        <p role="alert">This Cohort no longer exists.</p>
        <Link href="/campus" className={buttonVariants({ variant: "outline" })}>
          Back to Cohorts
        </Link>
      </main>
    );
  }

  if (
    cohortRead.kind === "unavailable" ||
    catalogueRead.kind === "unavailable"
  ) {
    return (
      <main className="grid justify-items-start gap-4 p-10">
        <p role="alert">
          We couldn&apos;t load this Cohort&apos;s Programme Tracks.
        </p>
        <a
          href={pageHref(cohortId, requestedPage)}
          className={buttonVariants({ variant: "outline" })}
        >
          Try again
        </a>
      </main>
    );
  }

  const attachedTrackIds = new Set(
    cohortRead.tracks.map(({ track }) => track.id),
  );
  const availableTracks = catalogueRead.tracks.filter(
    (track) => !attachedTrackIds.has(track.id),
  );
  const attachmentKey = availableTracks.map(({ id }) => id).join(":");

  return (
    <main className="grid gap-10 p-10">
      <header className="grid justify-items-start gap-3">
        <Link href="/campus">Back to Cohorts</Link>
        <div>
          <h1 className="text-2xl font-medium">
            {cohortRead.cohort.name} Programme Tracks
          </h1>
          <p className="text-foreground-secondary">{cohortRead.cohort.code}</p>
        </div>
      </header>

      <section aria-labelledby="attached-tracks-heading" className="grid gap-4">
        <h2 id="attached-tracks-heading" className="text-lg font-medium">
          Attached Tracks
        </h2>
        {cohortRead.tracks.length === 0 ? (
          <p className="text-foreground-secondary">
            No Programme Tracks are attached to this Cohort.
          </p>
        ) : (
          <ul className="grid gap-3">
            {cohortRead.tracks.map(({ id, track }) => (
              <li
                key={id}
                className="border-border flex items-center justify-between gap-4 rounded-xl border p-4"
              >
                <div>
                  <h3 className="font-medium">{track.name}</h3>
                  <p className="text-foreground-secondary text-sm">
                    {track.code}
                  </p>
                </div>
                <DetachCohortTrackDialog cohortId={cohortId} track={track} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="available-tracks-heading"
        className="grid gap-4"
      >
        <h2 id="available-tracks-heading" className="text-lg font-medium">
          Available Tracks
        </h2>
        {availableTracks.length === 0 ? (
          <p className="text-foreground-secondary">
            No unattached Programme Tracks are available on this page.
          </p>
        ) : (
          <AttachCohortTrackForm
            key={attachmentKey}
            cohortId={cohortId}
            tracks={availableTracks}
          />
        )}
        {catalogueRead.totalPages > 1 ? (
          <nav
            aria-label="Available Programme Track pages"
            className="flex gap-4"
          >
            {catalogueRead.page > 1 ? (
              <Link
                href={pageHref(cohortId, catalogueRead.page - 1)}
                className={buttonVariants({ variant: "outline" })}
              >
                Previous page
              </Link>
            ) : null}
            <span>
              Page {catalogueRead.page} of {catalogueRead.totalPages}
            </span>
            {catalogueRead.page < catalogueRead.totalPages ? (
              <Link
                href={pageHref(cohortId, catalogueRead.page + 1)}
                className={buttonVariants({ variant: "outline" })}
              >
                Next page
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
