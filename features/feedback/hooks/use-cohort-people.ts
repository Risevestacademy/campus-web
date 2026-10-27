import { useQuery } from "@tanstack/react-query";

import { browserApi } from "@/core/api/client/browser";

import { readCohortPeople } from "../services/cohort-people-api.adapter";

const FIVE_MINUTES = 5 * 60_000;

// Read only once a report is being written, and kept for the session so
// reopening the popup does not ask again. An unavailable read is not kept,
// so the next report tries again.
export function useCohortPeople({
  cohortId,
  enabled,
}: {
  cohortId: string | undefined;
  enabled: boolean;
}) {
  const query = useQuery({
    queryKey: ["feedback", "cohort-people", cohortId],
    queryFn: () => readCohortPeople(browserApi, cohortId ?? ""),
    enabled: enabled && cohortId !== undefined,
    staleTime: (current) =>
      current.state.data?.kind === "loaded" ? FIVE_MINUTES : 0,
    retry: false,
  });

  return query.data;
}
