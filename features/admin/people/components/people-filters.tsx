import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import Link from "next/link";

import { buttonVariants } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import { CHIP_LABELS } from "../people-format";
import { peopleHref } from "../people-href";
import { PEOPLE_CHIPS } from "../schemas/people-query.schema";
import type { PeopleView } from "../services/people-view.service";
import type { PeopleQuery, TrackOptionsRead } from "../types/people.types";

export function PeopleFilters({
  cohortId,
  query,
  tracks,
}: {
  cohortId: string;
  query: PeopleQuery;
  tracks: TrackOptionsRead;
}) {
  return (
    <form
      action={`/campus/${encodeURIComponent(cohortId)}/people`}
      method="get"
      role="search"
      className="flex flex-wrap items-center gap-3"
    >
      {query.chip === "all" ? null : (
        <input type="hidden" name="role" value={query.chip} />
      )}
      <label className="relative min-w-64 flex-1">
        <span className="sr-only">Search by name or email</span>
        <MagnifyingGlassIcon
          aria-hidden
          size={18}
          className="text-icon-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
        />
        <Input
          type="search"
          name="q"
          defaultValue={query.search}
          maxLength={128}
          placeholder="Search by name or email"
          className="h-11 rounded-xl pl-10"
        />
      </label>
      {tracks.kind === "loaded" && tracks.tracks.length > 0 ? (
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Track</span>
          <select
            name="track"
            defaultValue={query.trackId ?? ""}
            className="border-input bg-background h-11 rounded-xl border px-3 text-sm dark:bg-transparent"
          >
            <option value="">Track: All</option>
            {tracks.tracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button type="submit" className={buttonVariants({ variant: "outline" })}>
        Search
      </button>
    </form>
  );
}

export function PeopleChips({
  cohortId,
  query,
  counts,
}: {
  cohortId: string;
  query: PeopleQuery;
  counts: PeopleView["counts"];
}) {
  return (
    <nav aria-label="Filter by role">
      <ul className="flex flex-wrap gap-2">
        {PEOPLE_CHIPS.map((chip) => {
          const count = counts[chip];

          return (
            <li key={chip}>
              <Link
                href={peopleHref(cohortId, {
                  chip,
                  search: query.search,
                  trackId: query.trackId,
                })}
                aria-current={chip === query.chip ? "true" : undefined}
                className="border-border dark:aria-[current=true]:bg-primary inline-flex items-center rounded-full border px-4 py-2 text-sm hover:bg-[#E9ECF6] aria-[current=true]:border-transparent aria-[current=true]:bg-[#152228] aria-[current=true]:text-[#F7F7F7] dark:border-[#2B3B5F] dark:hover:bg-[#2B3B5F]"
              >
                {CHIP_LABELS[chip]}
                {count === undefined ? null : ` ${count}`}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
