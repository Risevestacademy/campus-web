import { afterEach, describe, expect, it, vi } from "vitest";

import {
  closeChat,
  getChatOpenSnapshot,
  getChatTabSnapshot,
  getServerChatOpenSnapshot,
  openChat,
  resetChat,
  setChatTab,
  subscribeToChatPanel,
  toggleChat,
} from "./chat-panel-store";

afterEach(() => {
  closeChat();
  setChatTab("chat");
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

  it("forgets both when reset", () => {
    setChatTab("people");
    openChat();

    resetChat();

    expect(getChatOpenSnapshot()).toBe(false);
    expect(getChatTabSnapshot()).toBe("chat");
  });

  it("keeps nothing in browser storage", () => {
    window.localStorage.clear();

    setChatTab("people");
    openChat();

    expect(window.localStorage.length).toBe(0);
  });
});
