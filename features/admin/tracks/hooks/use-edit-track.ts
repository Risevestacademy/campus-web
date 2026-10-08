"use client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { browserApi } from "@/core/api/client/browser";
import { replaceDocument } from "@/shared/lib/document-navigation";
import { toast } from "@/shared/ui/toast";

import { editTrack } from "../services/track-api.adapter";
import type {
  TrackEdit,
  TrackMutationProblem,
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
  const router = useRouter();
  const gate = useRef(false);
  const mutation = useMutation({
    mutationFn: (changes: TrackPatch) =>
      editTrack(browserApi, track.id, changes),
    retry: false,
    onSuccess: (outcome: TrackEdit, changes) => {
      if (outcome.kind === "updated") {
        toast.add({
          title: "Programme Track updated",
          description: changes.name ?? track.name,
          type: "success",
        });
        onEdited();
        router.refresh();
      } else if (outcome.problem === "signed-out") replaceDocument("/sign-in");
    },
    onSettled: () => {
      gate.current = false;
    },
  });
  function edit(changes: TrackPatch) {
    if (gate.current) return;
    gate.current = true;
    mutation.mutate(changes);
  }
  return {
    edit,
    isPending: mutation.isPending,
    problem:
      mutation.data?.kind === "problem"
        ? (mutation.data.problem as TrackMutationProblem)
        : undefined,
    reset: mutation.reset,
  };
}
