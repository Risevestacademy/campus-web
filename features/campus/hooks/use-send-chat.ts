import { useRef } from "react";
import { useStore } from "zustand";

import { presenceFor } from "@/core/presence";
import { type ChatAttachment, socialFor } from "@/core/realtime";

import { createSendBudget } from "../services/chat/send-budget";

// The longest line world takes, in characters, once trimmed.
export const CHAT_LINE_MAX_LENGTH = 500;

export type SendOutcome =
  "sent" | "empty" | "too-long" | "too-fast" | "not-ready";

// Whether a line could go out now, before any work is done for it.
export type SendReadiness = "ready" | "too-fast" | "not-ready";

// Says a line to the member's space. A line that is not sent is never lost:
// the caller keeps the text and says why.
export function useSendChat(cohortId: string) {
  const budget = useRef(createSendBudget());
  const synced = useStore(presenceFor(cohortId), (presence) => presence.synced);

  // A file is uploaded before its line is sent, so whether a line can go out
  // is asked first, and the member is not made to wait for nothing.
  function readiness(): SendReadiness {
    if (!synced) return "not-ready";
    return budget.current.available() ? "ready" : "too-fast";
  }

  // A line may be only a file; a line of text only is sent as it was.
  function send(text: string, attachment?: ChatAttachment): SendOutcome {
    const line = text.trim();
    if (line.length === 0 && !attachment) return "empty";
    if (line.length > CHAT_LINE_MAX_LENGTH) return "too-long";
    if (!budget.current.take()) return "too-fast";
    if (socialFor(cohortId).sendSay(line, attachment)) return "sent";

    budget.current.refund();
    return "not-ready";
  }

  return { readiness, send };
}
