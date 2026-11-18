import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import type { TrackSummary } from "../../tracks/types/track.types";
import { useAdminMutation } from "../../use-admin-mutation";
import {
  attachCohortTrack,
  detachCohortTrack,
} from "../services/cohort-track-api.adapter";
import type {
  CohortTrackAttachmentProblem,
  CohortTrackDetachmentProblem,
} from "../types/cohort-track.types";

export function useAttachCohortTrack(cohortId: string) {
  const { mutate, ...controls } = useAdminMutation<
    TrackSummary,
    CohortTrackAttachmentProblem
  >({
    mutationFn: (track: TrackSummary) =>
      attachCohortTrack(browserApi, cohortId, track.id),
    onSucceeded: (track) => {
      toast.add({
        title: "Programme Track attached",
        description: track.name,
        type: "success",
      });
    },
  });

  return {
    attach: mutate,
    ...controls,
  };
}

export function useDetachCohortTrack({
  cohortId,
  track,
  onDetached,
}: {
  cohortId: string;
  track: TrackSummary;
  onDetached: () => void;
}) {
  const { mutate, ...controls } = useAdminMutation<
    void,
    CohortTrackDetachmentProblem
  >({
    mutationFn: () => detachCohortTrack(browserApi, cohortId, track.id),
    onSucceeded: () => {
      onDetached();
      toast.add({
        title: "Programme Track detached",
        description: track.name,
        type: "success",
      });
    },
  });

  return {
    detach: () => mutate(undefined),
    ...controls,
  };
}
