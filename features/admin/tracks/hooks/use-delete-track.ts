import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import { deleteTrack } from "../services/track-api.adapter";
import type { TrackDeletionProblem, TrackSummary } from "../types/track.types";

export function useDeleteTrack({
  track,
  onDeleted,
}: {
  track: TrackSummary;
  onDeleted: () => void;
}) {
  const { mutate, ...controls } = useAdminMutation<void, TrackDeletionProblem>({
    mutationFn: () => deleteTrack(browserApi, track.id),
    onSucceeded: () => {
      toast.add({
        title: "Programme Track deleted",
        description: track.name,
        type: "success",
      });
      onDeleted();
    },
  });

  return {
    remove: () => mutate(undefined),
    ...controls,
  };
}
