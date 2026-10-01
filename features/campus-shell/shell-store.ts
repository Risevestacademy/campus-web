"use client";

import {
  DEFAULT_ACTIVE_PANEL,
  DEFAULT_SIDEBAR_OPEN,
  parseStoredShellPreferences,
  SHELL_CHANGE_EVENT,
  SHELL_STORAGE_KEY,
  type SidebarPanelId,
} from "./shell-preferences";

function readStoredPreferences() {
  try {
    return parseStoredShellPreferences(
      window.localStorage.getItem(SHELL_STORAGE_KEY),
    );
  } catch {
    return parseStoredShellPreferences(null);
  }
}

function writeStoredPreferences(
  preferences: ReturnType<typeof readStoredPreferences>,
): void {
  document.documentElement.dataset.sidebarOpen = String(
    preferences.sidebarOpen,
  );

  try {
    window.localStorage.setItem(SHELL_STORAGE_KEY, JSON.stringify(preferences));
  } catch {}

  window.dispatchEvent(new Event(SHELL_CHANGE_EVENT));
}

export function getActivePanelSnapshot(): SidebarPanelId {
  return readStoredPreferences().activePanel;
}

export function getServerActivePanelSnapshot(): SidebarPanelId {
  return DEFAULT_ACTIVE_PANEL;
}

export function getSidebarOpenSnapshot(): boolean {
  return readStoredPreferences().sidebarOpen;
}

export function getServerSidebarOpenSnapshot(): boolean {
  return DEFAULT_SIDEBAR_OPEN;
}

export function setActivePanel(activePanel: SidebarPanelId): void {
  writeStoredPreferences({
    ...readStoredPreferences(),
    activePanel,
    sidebarOpen: true,
  });
}

export function setSidebarOpen(sidebarOpen: boolean): void {
  writeStoredPreferences({ ...readStoredPreferences(), sidebarOpen });
}

export function toggleSidebar(): void {
  setSidebarOpen(!getSidebarOpenSnapshot());
}

export function closeSidebarForGridView(view: "map" | "grid"): void {
  if (view === "grid") setSidebarOpen(false);
}

export function subscribeToShell(onStoreChange: () => void): () => void {
  function handleStorage(event: StorageEvent): void {
    if (event.key !== null && event.key !== SHELL_STORAGE_KEY) return;

    onStoreChange();
  }

  window.addEventListener(SHELL_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(SHELL_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}
