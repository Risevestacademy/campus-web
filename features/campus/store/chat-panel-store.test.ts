import { afterEach, describe, expect, it, vi } from "vitest";

import {
  closeChat,
  getChatDraft,
  getChatOpenSnapshot,
  getChatReadThrough,
  getChatTabSnapshot,
  getServerChatOpenSnapshot,
  markChatReadThrough,
  openChat,
  resetChat,
  setChatDraft,
  setChatTab,
  subscribeToChatPanel,
  toggleChat,
} from "./chat-panel-store";

afterEach(() => {
  closeChat();
  setChatTab("chat");
  setChatDraft("c-1", "");
  markChatReadThrough("c-1", null);
});

describe("chat panel store", () => {
  it("starts closed on the Chat tab, and the server renders it closed", () => {
    expect(getChatOpenSnapshot()).toBe(false);
    expect(getChatTabSnapshot()).toBe("chat");
    expect(getServerChatOpenSnapshot()).toBe(false);
  });

  it("opens, closes and toggles", () => {
    openChat();
    expect(getChatOpenSnapshot()).toBe(true);

    toggleChat();
    expect(getChatOpenSnapshot()).toBe(false);

    toggleChat();
    expect(getChatOpenSnapshot()).toBe(true);

    closeChat();
    expect(getChatOpenSnapshot()).toBe(false);
  });

  it("opens on the tab it last showed", () => {
    setChatTab("people");
    openChat();

    closeChat();
    openChat();
    expect(getChatTabSnapshot()).toBe("people");
  });

  it("tells subscribers about a change and stays quiet about none", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToChatPanel(listener);

    openChat();
    openChat();
    setChatTab("resources");
    setChatTab("resources");
    closeChat();

    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    openChat();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("keeps a draft while the panel is closed or has left the screen", () => {
    openChat();
    setChatDraft("c-1", "half a thought");

    closeChat();
    openChat();
    resetChat();

    expect(getChatDraft("c-1")).toBe("half a thought");
  });

  it("keeps one cohort's draft and read line out of another", () => {
    setChatDraft("c-1", "for cohort one");
    markChatReadThrough("c-1", "line-7");

    expect(getChatDraft("c-2")).toBe("");
    expect(getChatReadThrough("c-2")).toBeNull();
  });

  it("remembers the newest line read", () => {
    expect(getChatReadThrough("c-1")).toBeNull();

    markChatReadThrough("c-1", "line-7");

    expect(getChatReadThrough("c-1")).toBe("line-7");
  });

  it("forgets whether it was open and on which tab when reset", () => {
    setChatTab("people");
    openChat();

    resetChat();

    expect(getChatOpenSnapshot()).toBe(false);
    expect(getChatTabSnapshot()).toBe("chat");
  });

  it("keeps nothing in browser storage, a draft included", () => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    setChatTab("people");
    openChat();
    setChatDraft("c-1", "a private word");
    markChatReadThrough("c-1", "line-7");

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
