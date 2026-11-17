import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { closeChat, openChat } from "../store/chat-panel-store";
import { SIDEBAR_STORAGE_KEY } from "../store/sidebar-preferences";
import {
  setActivePanel,
  setSidebarMode,
  setSidebarOpen,
} from "../store/sidebar-store";
import { useSidebarMode, useSidebarVisible } from "./use-sidebar-state";

beforeEach(() => {
  closeChat();
  window.localStorage.clear();
  Reflect.deleteProperty(document.documentElement.dataset, "sidebarOpen");
});

describe("sidebar mode", () => {
  it("stays in Campus mode without an administration panel", () => {
    setSidebarMode("admin");

    const { result } = renderHook(() => useSidebarMode("admin", false));

    expect(result.current).toBe("campus");
  });

  it("starts in Campus mode when nothing is stored", () => {
    const { result } = renderHook(() => useSidebarMode(undefined, true));

    expect(result.current).toBe("campus");
  });

  it("restores the stored mode when the route sets none", () => {
    setSidebarMode("admin");

    const { result } = renderHook(() => useSidebarMode(undefined, true));

    expect(result.current).toBe("admin");
  });

  it("enters in the route mode whatever is stored", () => {
    setSidebarMode("campus");

    const { result } = renderHook(() => useSidebarMode("admin", true));

    expect(result.current).toBe("admin");
  });

  it("follows a panel chosen after entering in the route mode", () => {
    const { result } = renderHook(() => useSidebarMode("admin", true));

    act(() => setActivePanel("tasks"));

    expect(result.current).toBe("campus");
  });
});

describe("sidebar visibility", () => {
  it("shows the sidebar the member left open", () => {
    const { result } = renderHook(() => useSidebarVisible());

    expect(result.current).toBe(true);
  });

  it("gives way to chat and returns when chat closes, without a saved change", () => {
    setSidebarOpen(true);
    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    const { result } = renderHook(() => useSidebarVisible());

    act(() => openChat());
    expect(result.current).toBe(false);

    act(() => closeChat());
    expect(result.current).toBe(true);
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe(saved);
  });

  it("stays hidden when the member collapsed it", () => {
    act(() => setSidebarOpen(false));
    const { result } = renderHook(() => useSidebarVisible());

    act(() => openChat());
    act(() => closeChat());

    expect(result.current).toBe(false);
  });
});
