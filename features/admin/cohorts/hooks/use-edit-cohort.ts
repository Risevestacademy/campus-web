import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { browserApi } from "@/core/api/client/browser";
import { replaceDocument } from "@/shared/lib/document-navigation";
import { toast } from "@/shared/ui/toast";

import { editCohort } from "../services/cohort-api.adapter";
import type {
  CohortEdit,
  CohortMutationProblem,
  CohortPatch,
  CohortSummary,
} from "../types/cohort.types";

const SIGN_IN_PATH = "/sign-in";

function explainUnavailable() {
  toast.add({
    title: "We couldn't update the cohort",
    description: "Nothing was changed. Check your connection and try again.",
    type: "error",
  });
}

export function useEditCohort({
  cohort,
  onEdited,
}: {
  cohort: CohortSummary;
  onEdited: () => void;
}) {
  const router = useRouter();
  const inFlight = useRef(false);

  function settle(outcome: CohortEdit, changes: CohortPatch) {
    if (outcome.kind === "updated") {
      onEdited();
      toast.add({
        title: "Cohort updated",
        description: changes.name ?? cohort.name,
        type: "success",
      });
      router.refresh();
    } else if (outcome.problem === "signed-out") {
      replaceDocument(SIGN_IN_PATH);
    } else if (outcome.problem === "unavailable") {
      explainUnavailable();
    }
  }

  const mutation = useMutation({
    mutationFn: (changes: CohortPatch) =>
      editCohort(browserApi, cohort.id, changes),
    retry: false,
    onSuccess: settle,
    onSettled: () => {
      inFlight.current = false;
    },
  });

  function edit(changes: CohortPatch) {
    if (inFlight.current) return;
    inFlight.current = true;
    mutation.mutate(changes);
  }

  const problem: CohortMutationProblem | undefined =
    mutation.data?.kind === "problem" ? mutation.data.problem : undefined;

  return {
    edit,
    isPending: mutation.isPending,
    problem,
    reset: mutation.reset,
  };
}
