import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import { editCohort } from "../services/cohort-api.adapter";
import type {
  CohortMutationProblem,
  CohortPatch,
  CohortSummary,
} from "../types/cohort.types";

export function useEditCohort({
  cohort,
  onEdited,
}: {
  cohort: CohortSummary;
  onEdited: () => void;
}) {
  const { mutate, ...controls } = useAdminMutation<
    CohortPatch,
    CohortMutationProblem
  >({
    mutationFn: (changes: CohortPatch) =>
      editCohort(browserApi, cohort.id, changes),
    onSucceeded: (changes) => {
      onEdited();
      toast.add({
        title: "Cohort updated",
        description: changes.name ?? cohort.name,
        type: "success",
      });
    },
  });

  return {
    edit: mutate,
    ...controls,
  };
}
