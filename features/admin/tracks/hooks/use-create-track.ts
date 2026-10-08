"use client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { browserApi } from "@/core/api/client/browser";
import { replaceDocument } from "@/shared/lib/document-navigation";
import { toast } from "@/shared/ui/toast";

import { createTrack } from "../services/track-api.adapter";
import type { NewTrack, TrackCreation } from "../types/track.types";
export function useCreateTrack({ onCreated }: { onCreated: () => void }) {
  const router = useRouter();
  const gate = useRef(false);
  const mutation = useMutation({
    mutationFn: (track: NewTrack) => createTrack(browserApi, track),
    retry: false,
    onSuccess: (outcome: TrackCreation, track) => {
      if (outcome.kind === "created") {
        toast.add({
          title: "Programme Track created",
          description: track.name,
          type: "success",
        });
        onCreated();
        router.refresh();
      } else if (outcome.problem === "signed-out") replaceDocument("/sign-in");
    },
    onSettled: () => {
      gate.current = false;
    },
  });
  function create(track: NewTrack) {
    if (gate.current) return;
    gate.current = true;
    mutation.mutate(track);
  }
  return {
    create,
    isPending: mutation.isPending,
    problem:
      mutation.data?.kind === "problem" ? mutation.data.problem : undefined,
    reset: mutation.reset,
  };
}
