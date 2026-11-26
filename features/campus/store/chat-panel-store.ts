"use client";

export const CHAT_TABS = ["chat", "people", "resources"] as const;
export type ChatTab = (typeof CHAT_TABS)[number];

// Not saved, and reset when the panel leaves the screen, so it opens closed on
// every visit. Opening it never changes the member's saved sidebar choice, so
// the sidebar returns by itself once chat closes.
type ChatPanelState = Readonly<{ open: boolean; tab: ChatTab }>;

const listeners = new Set<() => void>();
const CLOSED: ChatPanelState = { open: false, tab: "chat" };
let state: ChatPanelState = CLOSED;

function update(next: ChatPanelState): void {
  if (next.open === state.open && next.tab === state.tab) return;

  state = next;
  listeners.forEach((listener) => listener());
}

export function getChatOpenSnapshot(): boolean {
  return state.open;
}

export function getServerChatOpenSnapshot(): boolean {
  return false;
}

export function getChatTabSnapshot(): ChatTab {
  return state.tab;
}

export function getServerChatTabSnapshot(): ChatTab {
  return "chat";
}

export function openChat(): void {
  update({ ...state, open: true });
}

export function closeChat(): void {
  update({ ...state, open: false });
}

export function toggleChat(): void {
  update({ ...state, open: !state.open });
}

// Leaving the Active Campus (another page, another cohort) forgets the panel:
// the store outlives the page, and another page has no way to close it.
export function resetChat(): void {
  update(CLOSED);
}

export function setChatTab(tab: ChatTab): void {
  update({ ...state, tab });
}

export function subscribeToChatPanel(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  return () => {
    listeners.delete(onStoreChange);
  };
}
