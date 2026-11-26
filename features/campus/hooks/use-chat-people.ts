import { useMemo } from "react";

import { selectChatPeople } from "../services/chat/chat-people";
import { useMeetingPresence } from "./use-meeting-presence";

export function useChatPeople(cohortId: string) {
  const presence = useMeetingPresence(cohortId);

  return useMemo(() => selectChatPeople(presence), [presence]);
}
