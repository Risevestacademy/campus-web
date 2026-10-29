import { useQuery } from "@tanstack/react-query";

import { browserApi } from "@/core/api/client/browser";

import { readCohortDirectory } from "../services/cohort-directory-api.adapter";

const FIVE_MINUTES = 5 * 60_000;

// A loaded directory is fresh for five minutes, so the sidebar reopening does
// not ask again; an unavailable read is not kept, so the next mount tries again.
export function useCohortDirectory(cohortId: string) {
  const query = useQuery({
    queryKey: ["roster", "directory", cohortId],
    queryFn: () => readCohortDirectory(browserApi, cohortId),
    staleTime: (current) =>
      current.state.data?.kind === "loaded" ? FIVE_MINUTES : 0,
    retry: false,
  });

  return query.data;
}
