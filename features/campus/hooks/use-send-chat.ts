import { useRef } from "react";

import { socialFor } from "@/core/realtime";

import { createSendBudget } from "../services/chat/send-budget";

// The longest line world takes, in characters, once trimmed.
export const CHAT_LINE_MAX_LENGTH = 500;

export type SendOutcome =
  "sent" | "empty" | "too-long" | "too-fast" | "not-ready";

// Says a line to the member's space. A line that is not sent is never lost:
// the caller keeps the text and says why.
export function useSendChat(cohortId: string) {
  const budget = useRef(createSendBudget());

  function send(text: string): SendOutcome {
    const line = text.trim();
    if (line.length === 0) return "empty";
    if (line.length > CHAT_LINE_MAX_LENGTH) return "too-long";
    if (!budget.current.take()) return "too-fast";
    if (socialFor(cohortId).sendSay(line)) return "sent";

    budget.current.refund();
    return "not-ready";
  }

  return { send };
}
