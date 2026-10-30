import type { ApiClient } from "@/core/api/client";

import { INVITE_TABS } from "../schemas/invite-query.schema";
import type {
  InvitesListRead,
  InvitesQuery,
  InviteTab,
} from "../types/invite.types";
import { countInvites, listInvites } from "./invite-api.adapter";

export interface InvitesView {
  now: number;
  list: InvitesListRead;
  counts: Partial<Record<InviteTab, number>>;
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
  const [list, counts] = await Promise.all([
    listInvites(api, cohortId, query.tab, query.page),
    readCounts(api, cohortId),
  ]);

  return { now: Date.now(), list, counts };
}
