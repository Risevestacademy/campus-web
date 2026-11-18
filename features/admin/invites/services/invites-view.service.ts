import type { ApiClient } from "@/core/api/client";

import { readCohortTracks } from "../../cohorts/services/cohort-track-api.adapter";
import { INVITE_TABS } from "../schemas/invite-query.schema";
import type {
  InviteOptions,
  InvitesListRead,
  InvitesQuery,
  InviteTab,
} from "../types/invite.types";
import {
  countInvites,
  listGroupOptions,
  listInvites,
} from "./invite-api.adapter";

export interface InvitesView {
  now: number;
  list: InvitesListRead;
  counts: Partial<Record<InviteTab, number>>;
  options: InviteOptions;
}

async function readOptions(
  api: ApiClient,
  cohortId: string,
): Promise<InviteOptions> {
  const [tracks, groups] = await Promise.all([
    readCohortTracks(api, cohortId),
    listGroupOptions(api, cohortId),
  ]);

  return {
    tracks:
      tracks.kind === "loaded"
        ? {
            kind: "loaded",
            options: tracks.tracks.map(({ id, track }) => ({
              id,
              name: track.name,
              code: track.code,
            })),
          }
        : { kind: "unavailable" },
    groups,
  };
}

async function readCounts(
  api: ApiClient,
  cohortId: string,
): Promise<InvitesView["counts"]> {
  const totals = await Promise.all(
    INVITE_TABS.map((tab) => countInvites(api, cohortId, tab)),
  );

  return Object.fromEntries(
    INVITE_TABS.flatMap((tab, index) => {
      const read = totals[index];
      return read?.kind === "loaded" ? [[tab, read.total]] : [];
    }),
  );
}

export async function loadInvitesView(
  api: ApiClient,
  cohortId: string,
  query: InvitesQuery,
): Promise<InvitesView> {
  const [list, counts, options] = await Promise.all([
    listInvites(api, cohortId, query.tab, query.page),
    readCounts(api, cohortId),
    readOptions(api, cohortId),
  ]);

  return { now: Date.now(), list, counts, options };
}
