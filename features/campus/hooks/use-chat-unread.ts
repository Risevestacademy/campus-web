import { useStore } from "zustand";

import { presenceFor } from "@/core/presence";
import { useMountEffect } from "@/shared/lib/use-mount-effect";

import { selectChatLines, unreadCount } from "../services/chat/chat-messages";
import { markChatReadThrough } from "../store/chat-panel-store";
import { useChatReadThrough } from "./use-chat-panel";

// Lines from other people the member has not seen with the Chat tab showing.
export function useChatUnread(cohortId: string): number {
  const readThroughId = useChatReadThrough();

  return useStore(presenceFor(cohortId), (presence) =>
    unreadCount(selectChatLines(presence), presence.selfId, readThroughId),
  );
}

// Mount this where the Chat tab shows: everything said while it is there is
// read as it arrives.
export function useMarkChatRead(cohortId: string): void {
  useMountEffect(() => {
    const store = presenceFor(cohortId);

    function markNewest() {
      const lines = selectChatLines(store.getState());
      markChatReadThrough(lines.at(-1)?.id ?? null);
    }

    markNewest();
    return store.subscribe(markNewest);
  });
}
