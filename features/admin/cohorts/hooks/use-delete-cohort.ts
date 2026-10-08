import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { browserApi } from "@/core/api/client/browser";
import { replaceDocument } from "@/shared/lib/document-navigation";
import { toast } from "@/shared/ui/toast";

import { deleteCohort } from "../services/cohort-api.adapter";
import type {
  CohortDeletion,
  CohortMutationProblem,
  CohortSummary,
} from "../types/cohort.types";

const SIGN_IN_PATH = "/sign-in";

function explainUnavailable() {
  toast.add({
    title: "We couldn't delete the cohort",
    description: "Nothing was deleted. Check your connection and try again.",
    type: "error",
  });
}

export function useDeleteCohort({
  cohort,
  onDeleted,
}: {
  cohort: CohortSummary;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const inFlight = useRef(false);

  function settle(outcome: CohortDeletion) {
    if (outcome.kind === "deleted") {
      onDeleted();
      toast.add({
        title: "Cohort deleted",
        description: cohort.name,
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
    mutationFn: () => deleteCohort(browserApi, cohort.id),
    retry: false,
    onSuccess: settle,
    onSettled: () => {
      inFlight.current = false;
    },
  });

  function remove() {
    if (inFlight.current) return;
    inFlight.current = true;
    mutation.mutate();
  }

  const problem: CohortMutationProblem | undefined =
    mutation.data?.kind === "problem" ? mutation.data.problem : undefined;

  return {
    remove,
    isPending: mutation.isPending,
    problem,
    reset: mutation.reset,
  };
}
