import { useRouter } from "next/navigation";

import { ANALYTICS_EVENTS } from "@/core/analytics";
import { captureBrowserAnalyticsEvent } from "@/core/analytics/client";
import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import { createCohort } from "../services/cohort-api.adapter";
import type { CohortCreationProblem, NewCohort } from "../types/cohort.types";

const CHOOSER_PATH = "/campus";

interface CreateCohortOptions {
  page: number;
  onCreated: () => void;
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

  const { mutate, ...controls } = useAdminMutation<
    NewCohort,
    CohortCreationProblem
  >({
    mutationFn: (cohort: NewCohort) => createCohort(browserApi, cohort),
    onSucceeded: (cohort) => {
      announceCreated(cohort);
      onCreated();
      showNewestCohorts();
    },
    refreshAfterSuccess: false,
  });

  return {
    create: mutate,
    ...controls,
  };
}

export type CohortCreationControls = ReturnType<typeof useCreateCohort>;
