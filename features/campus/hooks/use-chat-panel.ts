import { useSyncExternalStore } from "react";

import {
  type ChatTab,
  getChatDraft,
  getChatOpenSnapshot,
  getChatReadThrough,
  getChatTabSnapshot,
  getServerChatOpenSnapshot,
  getServerChatTabSnapshot,
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
