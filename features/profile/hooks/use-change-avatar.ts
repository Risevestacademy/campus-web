import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { browserApi } from "@/core/api/client/browser";
import { SIGN_IN_PATH } from "@/core/navigation";
import {
  uploadMedia,
  type UploadProblem,
  wholeMegabytes,
} from "@/core/uploads";
import { replaceDocument } from "@/shared/lib/document-navigation";
import { toast } from "@/shared/ui/toast";

import { removeAvatar, setAvatar } from "../services/avatar-api.adapter";
import type { AvatarChange, AvatarProblem, OwnProfileRead } from "../types";
import { OWN_PROFILE_KEY } from "./use-own-profile";

export type AvatarActivity =
  | { kind: "idle" }
  | { kind: "uploading"; progress: number }
  | { kind: "saving" }
  | { kind: "removing" };

function uploadMessage(problem: UploadProblem): string | undefined {
  switch (problem.kind) {
    case "type-not-allowed":
      return "Campus couldn't take this picture's format. Choose a JPEG, PNG or WebP picture.";
    case "too-large":
      return problem.maxBytes
        ? `That picture is over ${wholeMegabytes(problem.maxBytes)}. Choose a smaller one.`
        : "That picture is too big. Choose a smaller one.";
    case "rate-limited":
      return "You've uploaded a lot just now. Wait a few minutes and try again.";
    case "unavailable":
      return "We couldn't upload your picture. Check your connection and try again.";
    case "signed-out":
    case "cancelled":
      return undefined;
  }
}

const AVATAR_MESSAGES: Record<AvatarProblem, string | undefined> = {
  expired: "Your picture didn't finish saving. Try again.",
  mismatch: "Your picture didn't finish saving. Try again.",
  "signed-out": undefined,
  unavailable:
    "We couldn't save your picture. Check your connection and try again.",
};

// Uploading, saving and removing the member's picture. A new picture goes up
// through `uploadMedia` and is then set with `PUT /v1/users/me/avatar`; the
// answer replaces the cached profile, and the route refreshes so avatars drawn
// from the session follow.
export function useChangeAvatar() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [activity, setActivity] = useState<AvatarActivity>({ kind: "idle" });
  const [problem, setProblem] = useState<string>();
  const upload = useRef<AbortController | null>(null);

  function apply(change: AvatarChange, done: string): boolean {
    if (change.kind === "changed") {
      const read: OwnProfileRead = { kind: "loaded", profile: change.profile };
      queryClient.setQueryData(OWN_PROFILE_KEY, read);
      toast.add({ title: done, type: "success" });
      router.refresh();
      return true;
    }
    if (change.problem === "signed-out") replaceDocument(SIGN_IN_PATH);
    setProblem(AVATAR_MESSAGES[change.problem]);
    return false;
  }

  async function changePicture(picture: Blob): Promise<boolean> {
    if (activity.kind !== "idle") return false;
    const controller = new AbortController();
    upload.current = controller;
    setProblem(undefined);
    setActivity({ kind: "uploading", progress: 0 });
    try {
      const uploaded = await uploadMedia({
        api: browserApi,
        kind: "avatar",
        file: picture,
        signal: controller.signal,
        onProgress: (progress) => setActivity({ kind: "uploading", progress }),
      });
      if (uploaded.kind === "problem") {
        if (uploaded.problem.kind === "signed-out") {
          replaceDocument(SIGN_IN_PATH);
        }
        setProblem(uploadMessage(uploaded.problem));
        return false;
      }
      setActivity({ kind: "saving" });
      return apply(
        await setAvatar(browserApi, uploaded.mediaId),
        "Picture updated",
      );
    } finally {
      upload.current = null;
      setActivity({ kind: "idle" });
    }
  }

  async function removePicture(): Promise<boolean> {
    if (activity.kind !== "idle") return false;
    setProblem(undefined);
    setActivity({ kind: "removing" });
    try {
      return apply(await removeAvatar(browserApi), "Picture removed");
    } finally {
      setActivity({ kind: "idle" });
    }
  }

  return {
    activity,
    problem,
    changePicture,
    removePicture,
    cancelUpload: () => upload.current?.abort(),
    clearProblem: () => setProblem(undefined),
  };
}
