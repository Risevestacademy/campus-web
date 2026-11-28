import type { ApiClient } from "@/core/api/client";

import { readCohortTracks } from "../../cohorts/services/cohort-track-api.adapter";
import { listGroupOptions } from "../../invites/services/invite-api.adapter";
import type { GrantOptions } from "../types/maps.types";

// The tracks and mentorship groups of the cohort a space's list can name. A
// track is named by the cohort's attachment of it, as a grant names it.
export async function readGrantOptions(
  api: ApiClient,
  cohortId: string,
): Promise<GrantOptions> {
  const [tracks, groups] = await Promise.all([
    readCohortTracks(api, cohortId),
    listGroupOptions(api, cohortId),
  ]);

  return {
    tracks:
      tracks.kind === "loaded"
        ? tracks.tracks.map(({ id, track }) => ({ id, name: track.name }))
        : null,
    groups:
      groups.kind === "loaded"
        ? groups.options.map(({ id, name }) => ({ id, name }))
        : null,
  };
}
