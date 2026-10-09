import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import { createTrack } from "../services/track-api.adapter";
import type { NewTrack, TrackCreationProblem } from "../types/track.types";

export function useCreateTrack({ onCreated }: { onCreated: () => void }) {
  const { mutate, ...controls } = useAdminMutation<
    NewTrack,
    TrackCreationProblem
  >({
    mutationFn: (track: NewTrack) => createTrack(browserApi, track),
    onSucceeded: (track) => {
      toast.add({
        title: "Programme Track created",
        description: track.name,
        type: "success",
      });
      onCreated();
    },
  });

  return {
    create: mutate,
    ...controls,
  };
}

export type TrackCreationControls = ReturnType<typeof useCreateTrack>;
