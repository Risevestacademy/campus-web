import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import { deleteCohort } from "../services/cohort-api.adapter";
import type {
  CohortMutationProblem,
  CohortSummary,
} from "../types/cohort.types";

export function useDeleteCohort({
  cohort,
  onDeleted,
}: {
  cohort: CohortSummary;
  onDeleted: () => void;
}) {
  const { mutate, ...controls } = useAdminMutation<void, CohortMutationProblem>(
    {
      mutationFn: () => deleteCohort(browserApi, cohort.id),
      onSucceeded: () => {
        onDeleted();
        toast.add({
          title: "Cohort deleted",
          description: cohort.name,
          type: "success",
        });
      },
    },
  );

  return {
    remove: () => mutate(undefined),
    ...controls,
  };
}
