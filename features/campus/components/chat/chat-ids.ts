// The control bar's button and the panel it opens find each other by these.
export const CHAT_PANEL_ID = "meeting-chat";
export const CHAT_TOGGLE_ID = "meeting-chat-toggle";

export function focusChatToggle(): void {
  document.getElementById(CHAT_TOGGLE_ID)?.focus();
}
