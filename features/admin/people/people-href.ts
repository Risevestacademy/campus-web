import type { Route } from "next";

import type { PeopleQuery } from "./types/people.types";

export function peopleHref(
  cohortId: string,
  view: Partial<PeopleQuery> = {},
): Route {
  const search = new URLSearchParams();

  if (view.chip && view.chip !== "all") search.set("role", view.chip);
  if (view.search) search.set("q", view.search);
  if (view.trackId) search.set("track", view.trackId);
  if (view.page && view.page > 1) search.set("page", String(view.page));

  const query = search.toString();
  const path = `/campus/${encodeURIComponent(cohortId)}/people`;

  return (query ? `${path}?${query}` : path) as Route;
}

export function personHref(cohortId: string, userId: string): Route {
  return `/campus/${encodeURIComponent(cohortId)}/people/${encodeURIComponent(userId)}` as Route;
}
