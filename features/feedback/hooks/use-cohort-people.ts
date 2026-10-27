import { skipToken, useQuery } from "@tanstack/react-query";

import { browserApi } from "@/core/api/client/browser";

import { readCohortPeople } from "../services/cohort-people-api.adapter";

const FIVE_MINUTES = 5 * 60_000;

export const COHORT_PEOPLE_KEY = ["feedback", "cohort-people"] as const;

// Without a cohort there is nobody to list. A loaded list is fresh for five
// minutes, so reopening the popup does not ask again; an unavailable read is
// not kept, so the next report tries again.
export function useCohortPeople(cohortId: string | undefined) {
  const query = useQuery({
    queryKey: [...COHORT_PEOPLE_KEY, cohortId],
    queryFn:
      cohortId === undefined
        ? skipToken
        : () => readCohortPeople(browserApi, cohortId),
    staleTime: (current) =>
      current.state.data?.kind === "loaded" ? FIVE_MINUTES : 0,
    retry: false,
  });

  return query.data;
}
