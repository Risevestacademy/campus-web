import { useRef, useState } from "react";
import { useStore } from "zustand";

import { browserApi } from "@/core/api/client/browser";
import { SIGN_IN_PATH } from "@/core/navigation";
import { presenceFor } from "@/core/presence";
import { uploadMedia, type UploadProblem } from "@/core/uploads";
import { replaceDocument } from "@/shared/lib/document-navigation";

import {
  type AttachProblem,
  attachToCall,
} from "../services/chat/chat-attachment-api.adapter";
import { type SendReadiness, useSendChat } from "./use-send-chat";

export type FileSendActivity =
  | { kind: "idle" }
  | { kind: "uploading"; fileName: string; progress: number }
  | { kind: "attaching"; fileName: string };

const IDLE: FileSendActivity = { kind: "idle" };

export const NO_ROOM_MESSAGE =
  "Files can be sent in meeting rooms, not in the corridors.";

const READINESS_MESSAGES = {
  "not-ready": "Reconnecting…",
  "too-fast": "You're sending too fast. Try again in a moment.",
} as const satisfies Record<Exclude<SendReadiness, "ready">, string>;

function megabytes(bytes: number) {
  return `${Math.max(1, Math.floor(bytes / (1024 * 1024)))} MB`;
}

function uploadMessage(problem: UploadProblem): string | undefined {
  switch (problem.kind) {
    case "type-not-allowed":
      return "That file's format isn't supported. Choose an image, PDF, Word, Excel or PowerPoint file.";
    case "too-large":
      return problem.maxBytes
        ? `That file is over ${megabytes(problem.maxBytes)}. Choose a smaller one.`
        : "That file is too big. Choose a smaller one.";
    case "rate-limited":
      return "You've uploaded a lot just now. Wait a few minutes and try again.";
    case "unavailable":
      return "We couldn't upload your file. Check your connection and try again.";
    case "signed-out":
    case "cancelled":
      return undefined;
  }
}

const ATTACH_MESSAGES: Record<AttachProblem, string | undefined> = {
  "no-call": "Files can be sent while a call is going on in this space.",
  "not-allowed": "You can't send files in this space.",
  "not-sent": "Your file didn't finish uploading. Try again.",
  "signed-out": undefined,
  unavailable:
    "We couldn't send your file. Check your connection and try again.",
};

// Sends a file to the member's space: uploads it, ties it to the space's call,
// then says it in chat. A file goes only where there is a call (a room, not the
// corridors) and when a line could go out, which is checked before any work is
// done, so nobody waits for an upload that could not be said.
export function useSendChatFile(cohortId: string) {
  const spaceId = useStore(
    presenceFor(cohortId),
    (presence) => presence.spaceId,
  );
  const { readiness, send } = useSendChat(cohortId);
  const [activity, setActivity] = useState<FileSendActivity>(IDLE);
  const [problem, setProblem] = useState<string>();
  const upload = useRef<AbortController | null>(null);

  function refuse(message: string | undefined, problemKind?: string) {
    if (problemKind === "signed-out") replaceDocument(SIGN_IN_PATH);
    setProblem(message);
    return false;
  }

  async function sendFile(file: File, caption: string): Promise<boolean> {
    if (activity.kind !== "idle") return false;
    setProblem(undefined);
    if (spaceId === null) return refuse(NO_ROOM_MESSAGE);
    const ready = readiness();
    if (ready !== "ready") return refuse(READINESS_MESSAGES[ready]);

    const controller = new AbortController();
    upload.current = controller;
    try {
      setActivity({ kind: "uploading", fileName: file.name, progress: 0 });
      const uploaded = await uploadMedia({
        api: browserApi,
        kind: "call_chat_attachment",
        file,
        fileName: file.name,
        signal: controller.signal,
        onProgress: (progress) =>
          setActivity({ kind: "uploading", fileName: file.name, progress }),
      });
      if (uploaded.kind === "problem") {
        return refuse(uploadMessage(uploaded.problem), uploaded.problem.kind);
      }

      setActivity({ kind: "attaching", fileName: file.name });
      const attached = await attachToCall(browserApi, {
        cohortId,
        mediaId: uploaded.mediaId,
        spaceId,
      });
      if (attached.kind === "problem") {
        return refuse(ATTACH_MESSAGES[attached.problem], attached.problem);
      }

      const outcome = send(caption, attached.attachment);
      if (outcome === "sent") return true;
      return refuse(
        outcome === "too-fast" || outcome === "not-ready"
          ? READINESS_MESSAGES[outcome]
          : undefined,
      );
    } finally {
      upload.current = null;
      setActivity(IDLE);
    }
  }

  return {
    activity,
    // Files go where a call is held; the corridors hold none.
    canAttach: spaceId !== null,
    cancel: () => upload.current?.abort(),
    clearProblem: () => setProblem(undefined),
    problem,
    sendFile,
  };
}
