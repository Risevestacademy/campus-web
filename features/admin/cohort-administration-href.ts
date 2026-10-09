import type { Route } from "next";

export type CohortAdministrationPage = "overview" | "tracks";

export function cohortAdministrationHref(
  cohortId: string,
  page: CohortAdministrationPage,
): Route {
  return `/campus/${encodeURIComponent(cohortId)}/${page}` as Route;
}
