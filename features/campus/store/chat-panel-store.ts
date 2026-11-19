"use client";

export const CHAT_TABS = ["chat", "people", "resources"] as const;
export type ChatTab = (typeof CHAT_TABS)[number];

// Not saved: the panel opens closed on every visit, and opening it never
// changes the member's saved sidebar choice, so the sidebar returns by
// itself once chat closes. The draft is what the member has typed and not
// sent, kept so closing the panel does not lose it; like everything said in
// chat it stays in memory and never reaches storage.
type ChatPanelState = Readonly<{
  draft: string;
  open: boolean;
  // The newest line the member has seen with the Chat tab showing.
  readThroughId: string | null;
  tab: ChatTab;
}>;

const INITIAL_STATE: ChatPanelState = {
  draft: "",
  open: false,
  readThroughId: null,
  tab: "chat",
};

const listeners = new Set<() => void>();
let state: ChatPanelState = INITIAL_STATE;

function update(next: ChatPanelState): void {
  if (
    next.draft === state.draft &&
    next.open === state.open &&
    next.readThroughId === state.readThroughId &&
    next.tab === state.tab
  ) {
    return;
  }

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

export function getChatDraftSnapshot(): string {
  return state.draft;
}

export function getServerChatDraftSnapshot(): string {
  return "";
}

export function getChatReadThroughSnapshot(): string | null {
  return state.readThroughId;
}

export function getServerChatReadThroughSnapshot(): string | null {
  return null;
}

export function setChatDraft(draft: string): void {
  update({ ...state, draft });
}

export function markChatReadThrough(readThroughId: string | null): void {
  update({ ...state, readThroughId });
}

export function openChat(tab?: ChatTab): void {
  update({ ...state, open: true, tab: tab ?? state.tab });
}

export function closeChat(): void {
  update({ ...state, open: false });
}

export function toggleChat(): void {
  update({ ...state, open: !state.open });
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
