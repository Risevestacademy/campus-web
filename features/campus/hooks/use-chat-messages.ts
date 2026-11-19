import { useMemo } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import { presenceFor } from "@/core/presence";

import { selectChatMessages } from "../services/chat/chat-messages";

// What the Chat tab draws: the lines said in the member's space, when they
// came into it, and whether the socket is up. As `useMeeting`, it selects the
// stable references and derives from them.
export function useChatMessages(cohortId: string) {
  const presence = useStore(
    presenceFor(cohortId),
    useShallow(({ chat, selfId, participants, spaceEnteredAt, synced }) => ({
      chat,
      selfId,
      participants,
      spaceEnteredAt,
      synced,
    })),
  );

  return useMemo(
    () => ({
      messages: selectChatMessages(presence),
      enteredAt: presence.spaceEnteredAt,
      synced: presence.synced,
    }),
    [presence],
  );
}
