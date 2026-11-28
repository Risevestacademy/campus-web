import type { ApiClient } from "@/core/api/client";

import { readCohortTracks } from "../../cohorts/services/cohort-track-api.adapter";
import { PEOPLE_CHIPS } from "../schemas/people-query.schema";
import type {
  CohortRole,
  FormerMembersRead,
  PeopleChip,
  PeopleCountRead,
  PeopleListRead,
  PeopleQuery,
  TrackOptionsRead,
} from "../types/people.types";
import { countPeople, listPeople } from "./people-api.adapter";
import { countFormerMembers, listFormerMembers } from "./roster-api.adapter";

export type PeopleViewList =
  | ({ scope: "current" } & PeopleListRead)
  | ({ scope: "former" } & FormerMembersRead);

export interface PeopleView {
  list: PeopleViewList;
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
  count: (role: CohortRole | undefined) => Promise<PeopleCountRead>,
): Promise<PeopleView["counts"]> {
  const totals = await Promise.all(
    PEOPLE_CHIPS.map((chip) => count(chip === "all" ? undefined : chip)),
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
  const role = query.chip === "all" ? undefined : query.chip;
  const tracks = readTrackOptions(api, cohortId);

  if (query.scope === "former") {
    const [list, counts] = await Promise.all([
      listFormerMembers(
        api,
        cohortId,
        { role, trackId: query.trackId },
        query.page,
      ),
      readCounts((chip) => countFormerMembers(api, cohortId, chip)),
    ]);
    return { list: { scope: "former", ...list }, counts, tracks: await tracks };
  }

  const [list, counts] = await Promise.all([
    listPeople(
      api,
      cohortId,
      { search: query.search, trackId: query.trackId, cohortRole: role },
      query.page,
    ),
    readCounts((chip) => countPeople(api, cohortId, chip)),
  ]);
  return { list: { scope: "current", ...list }, counts, tracks: await tracks };
}
