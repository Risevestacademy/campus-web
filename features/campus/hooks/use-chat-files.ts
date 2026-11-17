import { useMemo } from "react";

import { selectChatFiles } from "../services/chat/chat-files";
import { useChatMessages } from "./use-chat-messages";

// The files sent in the member's space, newest first.
export function useChatFiles(cohortId: string) {
  const { messages } = useChatMessages(cohortId);

  return useMemo(() => selectChatFiles(messages), [messages]);
}
