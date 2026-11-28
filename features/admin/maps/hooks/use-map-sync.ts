import { useState } from "react";

import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import { syncMaps } from "../services/maps-api.adapter";
import type {
  MapSyncOutcome,
  MapSyncProblem,
  MapSyncResult,
} from "../types/maps.types";

// One hook for the preview and the real sync, so whichever ran last is what
// the map shows.
export function useMapSync() {
  const [result, setResult] = useState<MapSyncResult>();
  const [mapProblems, setMapProblems] = useState<string[]>([]);

  const { mutate, ...controls } = useAdminMutation<
    { dryRun: boolean },
    MapSyncProblem,
    MapSyncOutcome
  >({
    mutationFn: async (variables) => {
      const outcome = await syncMaps(browserApi, variables);
      setMapProblems(outcome.kind === "problem" ? outcome.mapProblems : []);
      return outcome;
    },
    onSucceeded: (_variables, outcome) => {
      if (outcome.kind !== "synced") return;
      setResult(outcome.result);
      if (!outcome.result.dryRun) {
        toast.add({
          title: outcome.result.changed ? "Maps synced" : "Already up to date",
          type: "success",
        });
      }
    },
    // A preview keeps nothing, so there is nothing to read again.
    refreshAfterSuccess: (outcome) =>
      outcome.kind === "synced" && !outcome.result.dryRun,
  });

  return {
    preview: () => mutate({ dryRun: true }),
    sync: () => mutate({ dryRun: false }),
    result,
    mapProblems,
    ...controls,
  };
}
