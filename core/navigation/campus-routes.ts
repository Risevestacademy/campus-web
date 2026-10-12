import type { Route } from "next";

const CAMPUS_PRE_JOIN_COMPLETION_PARAMETER = "prejoin";
const ROUTE_ORIGIN = "https://campus.invalid";

// Typed routes cannot check runtime-built hrefs, so each builder casts here
// and callers never need to.
export function campusHref(cohortId: string): Route {
  return `/campus/${encodeURIComponent(cohortId)}` as Route;
}

export function campusJoinHref(cohortId: string): Route {
  return `${campusHref(cohortId)}/join` as Route;
}

function removeLegacyCampusPreJoinCompletion(activeHref: string): string {
  const url = new URL(activeHref, ROUTE_ORIGIN);
  url.searchParams.delete(CAMPUS_PRE_JOIN_COMPLETION_PARAMETER);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function campusPreJoinHref(cohortId: string, activeHref: string): Route {
  const searchParameters = new URLSearchParams({
    returnTo: removeLegacyCampusPreJoinCompletion(activeHref),
  });
  return `${campusJoinHref(cohortId)}?${searchParameters.toString()}` as Route;
}
