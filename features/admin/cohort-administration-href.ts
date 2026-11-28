import type { Route } from "next";

export type CohortAdministrationPage =
  "overview" | "people" | "invites" | "tracks" | "maps" | "feedback";

export function cohortAdministrationHref(
  cohortId: string,
  page: CohortAdministrationPage,
): Route {
  return `/campus/${encodeURIComponent(cohortId)}/${page}` as Route;
}
