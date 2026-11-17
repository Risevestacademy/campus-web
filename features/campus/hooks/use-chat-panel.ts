import { useSyncExternalStore } from "react";

import {
  type ChatTab,
  getChatOpenSnapshot,
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
