"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { browserApi } from "@/core/api/client/browser";
import { replaceDocument } from "@/shared/lib/document-navigation";
import { toast } from "@/shared/ui/toast";

import type { TrackSummary } from "../../tracks/types/track.types";
import {
  attachCohortTrack,
  detachCohortTrack,
} from "../services/cohort-track-api.adapter";

export function useAttachCohortTrack(cohortId: string) {
  const router = useRouter();
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: (track: TrackSummary) =>
      attachCohortTrack(browserApi, cohortId, track.id),
    retry: false,
    onSuccess: (outcome, track) => {
      if (outcome.kind === "attached") {
        toast.add({
          title: "Programme Track attached",
          description: track.name,
          type: "success",
        });
        router.refresh();
      } else if (outcome.problem === "signed-out") {
        replaceDocument("/sign-in");
      }
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });

  function attach(track: TrackSummary) {
    if (inFlight.current) return;
    inFlight.current = true;
    mutation.reset();
    mutation.mutate(track);
  }

  return {
    attach,
    isPending: mutation.isPending,
    problem:
      mutation.data?.kind === "problem" ? mutation.data.problem : undefined,
    reset: mutation.reset,
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
  const router = useRouter();
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: () => detachCohortTrack(browserApi, cohortId, track.id),
    retry: false,
    onSuccess: (outcome) => {
      if (outcome.kind === "detached") {
        onDetached();
        toast.add({
          title: "Programme Track detached",
          description: track.name,
          type: "success",
        });
        router.refresh();
      } else if (outcome.problem === "signed-out") {
        replaceDocument("/sign-in");
      }
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });

  function detach() {
    if (inFlight.current) return;
    inFlight.current = true;
    mutation.reset();
    mutation.mutate();
  }

  return {
    detach,
    isPending: mutation.isPending,
    problem:
      mutation.data?.kind === "problem" ? mutation.data.problem : undefined,
    reset: mutation.reset,
  };
}
