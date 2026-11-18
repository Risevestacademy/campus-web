import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import { editTrack } from "../services/track-api.adapter";
import type {
  TrackEditProblem,
  TrackPatch,
  TrackSummary,
} from "../types/track.types";

export function useEditTrack({
  track,
  onEdited,
}: {
  track: TrackSummary;
  onEdited: () => void;
}) {
  const { mutate, ...controls } = useAdminMutation<
    TrackPatch,
    TrackEditProblem
  >({
    mutationFn: (changes: TrackPatch) =>
      editTrack(browserApi, track.id, changes),
    onSucceeded: (changes) => {
      toast.add({
        title: "Programme Track updated",
        description: changes.name ?? track.name,
        type: "success",
      });
      onEdited();
    },
  });

  return {
    edit: mutate,
    ...controls,
  };
}
