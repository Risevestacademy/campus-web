import type { Route } from "next";

interface CampusSearchParameters {
  get(name: string): string | null;
}

const CAMPUS_PRE_JOIN_COMPLETION_PARAMETER = "prejoin";
const CAMPUS_PRE_JOIN_COMPLETION_VALUE = "complete";
const ROUTE_ORIGIN = "https://campus.invalid";

// Typed routes cannot check runtime-built hrefs, so each builder casts here
// and callers never need to.
export function campusHref(cohortId: string): Route {
  return `/campus/${encodeURIComponent(cohortId)}` as Route;
}

export function campusJoinHref(cohortId: string): Route {
  return `${campusHref(cohortId)}/join` as Route;
}

export function hasCampusPreJoinCompletion(
  searchParameters: CampusSearchParameters,
): boolean {
  return (
    searchParameters.get(CAMPUS_PRE_JOIN_COMPLETION_PARAMETER) ===
    CAMPUS_PRE_JOIN_COMPLETION_VALUE
  );
}

export function removeCampusPreJoinCompletion(activeHref: string): string {
  const url = new URL(activeHref, ROUTE_ORIGIN);
  url.searchParams.delete(CAMPUS_PRE_JOIN_COMPLETION_PARAMETER);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function campusPreJoinHref(cohortId: string, activeHref: string): Route {
  const searchParameters = new URLSearchParams({
    returnTo: removeCampusPreJoinCompletion(activeHref),
  });
  return `${campusJoinHref(cohortId)}?${searchParameters.toString()}` as Route;
}

export function withCampusPreJoinCompletion(activeHref: string): Route {
  const url = new URL(activeHref, ROUTE_ORIGIN);
  url.searchParams.set(
    CAMPUS_PRE_JOIN_COMPLETION_PARAMETER,
    CAMPUS_PRE_JOIN_COMPLETION_VALUE,
  );
  return `${url.pathname}${url.search}` as Route;
}
