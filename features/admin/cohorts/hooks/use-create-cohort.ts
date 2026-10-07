import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { ANALYTICS_EVENTS } from "@/core/analytics";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import { browserApi } from "@/core/api/client/browser";
import { replaceDocument } from "@/shared/lib/document-navigation";
import { toast } from "@/shared/ui/toast";

import { createCohort } from "../services/cohort-api.adapter";
import type {
  CohortCreation,
  CohortCreationProblem,
  NewCohort,
} from "../types/cohort.types";

const SIGN_IN_PATH = "/sign-in";
const CHOOSER_PATH = "/campus";

type InlineCreationProblem = Extract<
  CohortCreationProblem,
  "duplicate-code" | "rejected"
>;

interface CreateCohortOptions {
  page: number;
  onCreated: () => void;
}

function inlineProblem(
  outcome: CohortCreation | undefined,
): InlineCreationProblem | undefined {
  if (outcome?.kind !== "problem") return undefined;
  const { problem } = outcome;
  return problem === "duplicate-code" || problem === "rejected"
    ? problem
    : undefined;
}

function explainFailure() {
  toast.add({
    title: "We couldn't create the cohort",
    description: "Nothing was saved. Check your connection and try again.",
    type: "error",
  });
}

function announceCreated(cohort: NewCohort) {
  captureBrowserAnalyticsEvent(ANALYTICS_EVENTS.COHORT_CREATED, {
    cohort_status: cohort.status,
  });
  toast.add({
    title: "Cohort created",
    description: cohort.name,
    type: "success",
  });
}

export function useCreateCohort({ page, onCreated }: CreateCohortOptions) {
  const router = useRouter();

  // The list is newest first, so the new cohort is on page 1. A push to the
  // URL already shown may keep the current tree, so page 1 refreshes instead.
  function showNewestCohorts() {
    if (page === 1) router.refresh();
    else router.push(CHOOSER_PATH);
  }

  function settle(outcome: CohortCreation, cohort: NewCohort) {
    if (outcome.kind === "created") {
      announceCreated(cohort);
      onCreated();
      showNewestCohorts();
    } else if (outcome.problem === "signed-out") {
      replaceDocument(SIGN_IN_PATH);
    } else if (!inlineProblem(outcome)) {
      explainFailure();
    }
  }

  // isPending reaches React on a later tick, so a double-click or held Enter
  // would pass a state check. The ref closes the gate synchronously.
  const inFlight = useRef(false);

  // Never retried: if a 201 is lost, a retry is a 409 for a cohort that does
  // exist, and a silent second POST could create a near-duplicate.
  const creation = useMutation({
    mutationFn: (cohort: NewCohort) => createCohort(browserApi, cohort),
    retry: false,
    onSuccess: settle,
    onSettled: () => {
      inFlight.current = false;
    },
  });

  function create(cohort: NewCohort) {
    if (inFlight.current) return;
    inFlight.current = true;
    creation.mutate(cohort);
  }

  return {
    create,
    isPending: creation.isPending,
    problem: inlineProblem(creation.data),
    reset: creation.reset,
  };
}

export type CohortCreationControls = ReturnType<typeof useCreateCohort>;
