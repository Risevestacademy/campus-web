import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { browserApi } from "@/core/api/client/browser";
import { SIGN_IN_PATH } from "@/core/navigation";
import { replaceDocument } from "@/shared/lib/document-navigation";
import { toast } from "@/shared/ui/toast";

import { saveOwnProfile } from "../services/own-profile-api.adapter";
import type { OwnProfileRead, ProfilePatch } from "../types";
import { OWN_PROFILE_KEY } from "./use-own-profile";

export function useSaveOwnProfile({ onSaved }: { onSaved: () => void }) {
  const inFlight = useRef(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: (changes: ProfilePatch) => saveOwnProfile(browserApi, changes),
    // A retry after a lost response is harmless for a patch, but it would
    // hold the Save button for nothing: the member can press it again.
    retry: false,
    onSuccess: (outcome) => {
      if (outcome.kind === "saved") {
        const read: OwnProfileRead = {
          kind: "loaded",
          profile: outcome.profile,
        };
        queryClient.setQueryData(OWN_PROFILE_KEY, read);
        toast.add({ title: "Profile saved", type: "success" });
        // The rail and dock draw the member from the session the route
        // layout read, so a new name shows once the layout reads it again.
        router.refresh();
        onSaved();
      } else if (outcome.problem === "signed-out") {
        replaceDocument(SIGN_IN_PATH);
      }
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });

  function save(changes: ProfilePatch) {
    if (inFlight.current) return;
    inFlight.current = true;
    mutation.reset();
    mutation.mutate(changes);
  }

  return {
    save,
    reset: mutation.reset,
    isPending: mutation.isPending,
    problem:
      mutation.data?.kind === "problem" ? mutation.data.problem : undefined,
  };
}
