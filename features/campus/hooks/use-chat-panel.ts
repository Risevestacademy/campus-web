import { useSyncExternalStore } from "react";

import {
  type ChatTab,
  getChatDraft,
  getChatOpenSnapshot,
  getChatReadThrough,
  getChatTabSnapshot,
  getGoneFileIdsSnapshot,
  getServerChatOpenSnapshot,
  getServerChatTabSnapshot,
  getServerGoneFileIdsSnapshot,
  subscribeToChatPanel,
} from "../store/chat-panel-store";

export function useChatOpen(): boolean {
  return useSyncExternalStore(
    subscribeToChatPanel,
    getChatOpenSnapshot,
    getServerChatOpenSnapshot,
  );
}

export function useChatTab(): ChatTab {
  return useSyncExternalStore(
    subscribeToChatPanel,
    getChatTabSnapshot,
    getServerChatTabSnapshot,
  );
}

export function useChatDraft(cohortId: string): string {
  return useSyncExternalStore(
    subscribeToChatPanel,
    () => getChatDraft(cohortId),
    () => "",
  );
}

export function useChatReadThrough(cohortId: string): string | null {
  return useSyncExternalStore(
    subscribeToChatPanel,
    () => getChatReadThrough(cohortId),
    () => null,
  );
}

// The files that answered 410 when opened.
export function useGoneFileIds(): readonly string[] {
  return useSyncExternalStore(
    subscribeToChatPanel,
    getGoneFileIdsSnapshot,
    getServerGoneFileIdsSnapshot,
  );
}
