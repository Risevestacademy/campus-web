import { useSyncExternalStore } from "react";

import {
  type ChatTab,
  getChatDraftSnapshot,
  getChatOpenSnapshot,
  getChatReadThroughSnapshot,
  getChatTabSnapshot,
  getGoneFileIdsSnapshot,
  getServerChatDraftSnapshot,
  getServerChatOpenSnapshot,
  getServerChatReadThroughSnapshot,
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

export function useChatDraft(): string {
  return useSyncExternalStore(
    subscribeToChatPanel,
    getChatDraftSnapshot,
    getServerChatDraftSnapshot,
  );
}

export function useChatReadThrough(): string | null {
  return useSyncExternalStore(
    subscribeToChatPanel,
    getChatReadThroughSnapshot,
    getServerChatReadThroughSnapshot,
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
