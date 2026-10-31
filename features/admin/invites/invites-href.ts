import type { Route } from "next";

import type { InvitesQuery } from "./types/invite.types";

export function invitesHref(
  cohortId: string,
  view: Partial<InvitesQuery> = {},
): Route {
  const search = new URLSearchParams();

  if (view.tab && view.tab !== "pending") search.set("status", view.tab);
  if (view.page && view.page > 1) search.set("page", String(view.page));

  const query = search.toString();
  const path = `/campus/${encodeURIComponent(cohortId)}/invites`;

  return (query ? `${path}?${query}` : path) as Route;
}
