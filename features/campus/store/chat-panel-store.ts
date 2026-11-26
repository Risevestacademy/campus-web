"use client";

export const CHAT_TABS = ["chat", "people", "resources"] as const;
export type ChatTab = (typeof CHAT_TABS)[number];

// Not saved. Whether it is open and which tab shows are reset when the panel
// leaves the screen, so it opens closed on every visit. Opening it never changes
// the member's saved sidebar choice, so the sidebar returns by itself once chat
// closes. The draft (what the member typed and has not sent) and the newest line
// read are kept per cohort, so one cohort's words never show in another and
// nothing typed is lost by leaving. Like everything said in chat they stay in
// memory and never reach storage.
type ChatPanelState = Readonly<{
  // By cohort id.
  drafts: Readonly<Record<string, string>>;
  open: boolean;
  // By cohort id: the newest line seen with the Chat tab showing.
  readThroughIds: Readonly<Record<string, string | null>>;
  tab: ChatTab;
}>;

const INITIAL_STATE: ChatPanelState = {
  drafts: {},
  open: false,
  readThroughIds: {},
  tab: "chat",
};

const listeners = new Set<() => void>();
let state: ChatPanelState = INITIAL_STATE;

function update(next: ChatPanelState): void {
  if (
    next.drafts === state.drafts &&
    next.open === state.open &&
    next.readThroughIds === state.readThroughIds &&
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

export function getChatDraft(cohortId: string): string {
  return state.drafts[cohortId] ?? "";
}

export function getChatReadThrough(cohortId: string): string | null {
  return state.readThroughIds[cohortId] ?? null;
}

export function setChatDraft(cohortId: string, draft: string): void {
  if (draft === getChatDraft(cohortId)) return;

  update({ ...state, drafts: { ...state.drafts, [cohortId]: draft } });
}

export function markChatReadThrough(
  cohortId: string,
  readThroughId: string | null,
): void {
  if (readThroughId === getChatReadThrough(cohortId)) return;

  update({
    ...state,
    readThroughIds: { ...state.readThroughIds, [cohortId]: readThroughId },
  });
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

// Leaving the Active Campus (another page, another cohort) closes the panel:
// the store outlives the page, and another page has no way to close it.
export function resetChat(): void {
  update({ ...state, open: false, tab: "chat" });
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
