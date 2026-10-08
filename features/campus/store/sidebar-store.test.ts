import { beforeEach, describe, expect, it, vi } from "vitest";

import { SIDEBAR_STORAGE_KEY } from "./sidebar-preferences";
import {
  getActivePanelSnapshot,
  getSidebarModeSnapshot,
  getSidebarOpenSnapshot,
  setActivePanel,
  setSidebarMode,
  setSidebarOpen,
  subscribeToSidebar,
  toggleSidebar,
} from "./sidebar-store";

beforeEach(() => {
  window.localStorage.clear();
  Reflect.deleteProperty(document.documentElement.dataset, "sidebarOpen");
});

describe("sidebar store", () => {
  it("defaults to the map panel open", () => {
    expect(getActivePanelSnapshot()).toBe("map");
    expect(getSidebarModeSnapshot()).toBeUndefined();
    expect(getSidebarOpenSnapshot()).toBe(true);
  });

  it("persists administration mode and returns to Campus for a panel", () => {
    setSidebarMode("admin");

    expect(getSidebarModeSnapshot()).toBe("admin");
    expect(getSidebarOpenSnapshot()).toBe(true);

    setActivePanel("chat");

    expect(getSidebarModeSnapshot()).toBe("campus");
    expect(getActivePanelSnapshot()).toBe("chat");
  });

  it("persists the active panel and reopens the sidebar", () => {
    setSidebarOpen(false);

    setActivePanel("chat");

    expect(getActivePanelSnapshot()).toBe("chat");
    expect(getSidebarOpenSnapshot()).toBe(true);
    expect(
      JSON.parse(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) ?? "{}"),
    ).toMatchObject({ activePanel: "chat", sidebarOpen: true });
  });

  it("toggles the sidebar and mirrors the state on the document element", () => {
    toggleSidebar();
    expect(getSidebarOpenSnapshot()).toBe(false);
    expect(document.documentElement.dataset.sidebarOpen).toBe("false");

    toggleSidebar();
    expect(getSidebarOpenSnapshot()).toBe(true);
    expect(document.documentElement.dataset.sidebarOpen).toBe("true");
  });

  it("ignores a corrupted value stored for another key", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "not json");

    expect(getActivePanelSnapshot()).toBe("map");
    expect(getSidebarOpenSnapshot()).toBe(true);
  });

  it("synchronizes preference changes received from another browser tab", () => {
    const onStoreChange = vi.fn();
    const unsubscribe = subscribeToSidebar(onStoreChange);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: SIDEBAR_STORAGE_KEY,
        newValue: JSON.stringify({ activePanel: "tasks", sidebarOpen: true }),
      }),
    );

    expect(onStoreChange).toHaveBeenCalledOnce();

    unsubscribe();

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: SIDEBAR_STORAGE_KEY,
        newValue: JSON.stringify({
          activePanel: "calendar",
          sidebarOpen: true,
        }),
      }),
    );

    expect(onStoreChange).toHaveBeenCalledOnce();
  });
});
