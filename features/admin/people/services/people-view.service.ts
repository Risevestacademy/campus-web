import type { ApiClient } from "@/core/api/client";

import { readCohortTracks } from "../../cohorts/services/cohort-track-api.adapter";
import { PEOPLE_CHIPS } from "../schemas/people-query.schema";
import type {
  PeopleChip,
  PeopleListRead,
  PeopleQuery,
  TrackOptionsRead,
} from "../types/people.types";
import { countPeople, listPeople } from "./people-api.adapter";

export interface PeopleView {
  list: PeopleListRead;
  counts: Partial<Record<PeopleChip, number>>;
  tracks: TrackOptionsRead;
}

async function readTrackOptions(
  api: ApiClient,
  cohortId: string,
): Promise<TrackOptionsRead> {
  const read = await readCohortTracks(api, cohortId);
  if (read.kind !== "loaded") return { kind: "unavailable" };

  return {
    kind: "loaded",
    tracks: read.tracks.map(({ track }) => ({
      id: track.id,
      name: track.name,
    })),
  };
}

async function readCounts(
  api: ApiClient,
  cohortId: string,
): Promise<PeopleView["counts"]> {
  const totals = await Promise.all(
    PEOPLE_CHIPS.map((chip) =>
      countPeople(api, cohortId, chip === "all" ? undefined : chip),
    ),
  );

  return Object.fromEntries(
    PEOPLE_CHIPS.flatMap((chip, index) => {
      const read = totals[index];
      return read?.kind === "loaded" ? [[chip, read.total]] : [];
    }),
  );
}

export async function loadPeopleView(
  api: ApiClient,
  cohortId: string,
  query: PeopleQuery,
): Promise<PeopleView> {
  const [list, counts, tracks] = await Promise.all([
    listPeople(
      api,
      cohortId,
      {
        search: query.search,
        trackId: query.trackId,
        cohortRole: query.chip === "all" ? undefined : query.chip,
      },
      query.page,
    ),
    readCounts(api, cohortId),
    readTrackOptions(api, cohortId),
  ]);

  return { list, counts, tracks };
}
