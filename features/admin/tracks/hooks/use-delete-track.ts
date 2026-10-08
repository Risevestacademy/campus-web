"use client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { browserApi } from "@/core/api/client/browser";
import { replaceDocument } from "@/shared/lib/document-navigation";
import { toast } from "@/shared/ui/toast";

import { deleteTrack } from "../services/track-api.adapter";
import type { TrackDeletion, TrackSummary } from "../types/track.types";
export function useDeleteTrack({
  track,
  onDeleted,
}: {
  track: TrackSummary;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const gate = useRef(false);
  const mutation = useMutation({
    mutationFn: () => deleteTrack(browserApi, track.id),
    retry: false,
    onSuccess: (outcome: TrackDeletion) => {
      if (outcome.kind === "deleted") {
        toast.add({
          title: "Programme Track deleted",
          description: track.name,
          type: "success",
        });
        onDeleted();
        router.refresh();
      } else if (outcome.problem === "signed-out") replaceDocument("/sign-in");
    },
    onSettled: () => {
      gate.current = false;
    },
  });
  function remove() {
    if (gate.current) return;
    gate.current = true;
    mutation.mutate();
  }
  return {
    remove,
    isPending: mutation.isPending,
    problem:
      mutation.data?.kind === "problem" ? mutation.data.problem : undefined,
    reset: mutation.reset,
  };
}
