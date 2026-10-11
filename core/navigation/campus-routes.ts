type CampusHref = `/campus/${string}`;
type CampusJoinHref = `${CampusHref}/join`;

interface CampusSearchParameters {
  get(name: string): string | null;
}

const CAMPUS_PRE_JOIN_COMPLETION_PARAMETER = "prejoin";
const CAMPUS_PRE_JOIN_COMPLETION_VALUE = "complete";
const ROUTE_ORIGIN = "https://campus.invalid";

export function campusHref(cohortId: string): CampusHref {
  return `/campus/${encodeURIComponent(cohortId)}` as CampusHref;
}

export function campusJoinHref(cohortId: string): CampusJoinHref {
  return `${campusHref(cohortId)}/join` as CampusJoinHref;
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

export function campusPreJoinHref(
  cohortId: string,
  activeHref: string,
): string {
  const searchParameters = new URLSearchParams({
    returnTo: removeCampusPreJoinCompletion(activeHref),
  });
  return `${campusJoinHref(cohortId)}?${searchParameters.toString()}`;
}

export function withCampusPreJoinCompletion(activeHref: string): string {
  const url = new URL(activeHref, ROUTE_ORIGIN);
  url.searchParams.set(
    CAMPUS_PRE_JOIN_COMPLETION_PARAMETER,
    CAMPUS_PRE_JOIN_COMPLETION_VALUE,
  );
  return `${url.pathname}${url.search}`;
}
