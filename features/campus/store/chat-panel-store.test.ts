import { afterEach, describe, expect, it, vi } from "vitest";

import {
  closeChat,
  getChatDraftSnapshot,
  getChatOpenSnapshot,
  getChatReadThroughSnapshot,
  getChatTabSnapshot,
  getServerChatOpenSnapshot,
  markChatReadThrough,
  openChat,
  setChatDraft,
  setChatTab,
  subscribeToChatPanel,
  toggleChat,
} from "./chat-panel-store";

afterEach(() => {
  closeChat();
  setChatTab("chat");
  setChatDraft("");
  markChatReadThrough(null);
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

  it("opens on a tab when asked, and otherwise on the one it last showed", () => {
    openChat("people");
    expect(getChatTabSnapshot()).toBe("people");

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

  it("keeps a draft while the panel is closed", () => {
    openChat();
    setChatDraft("half a thought");

    closeChat();
    openChat();

    expect(getChatDraftSnapshot()).toBe("half a thought");
  });

  it("remembers the newest line read", () => {
    expect(getChatReadThroughSnapshot()).toBeNull();

    markChatReadThrough("line-7");

    expect(getChatReadThroughSnapshot()).toBe("line-7");
  });

  it("keeps nothing in browser storage, a draft included", () => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    openChat("people");
    setChatDraft("a private word");
    markChatReadThrough("line-7");

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
