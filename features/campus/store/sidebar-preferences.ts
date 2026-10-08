export type SidebarPanelId = "search" | "map" | "chat" | "tasks" | "calendar";
export type SidebarMode = "campus" | "admin";

export const SIDEBAR_PANEL_IDS: readonly SidebarPanelId[] = [
  "search",
  "map",
  "chat",
  "tasks",
  "calendar",
];

export function isSidebarPanelId(value: unknown): value is SidebarPanelId {
  return (
    typeof value === "string" &&
    (SIDEBAR_PANEL_IDS as readonly string[]).includes(value)
  );
}

export function isSidebarMode(value: unknown): value is SidebarMode {
  return value === "campus" || value === "admin";
}

export const SIDEBAR_STORAGE_KEY = "campus-sidebar";
export const SIDEBAR_CHANGE_EVENT = "campus-sidebar-change";

export const DEFAULT_ACTIVE_PANEL: SidebarPanelId = "map";
export const DEFAULT_SIDEBAR_OPEN = true;

type StoredSidebarPreferences = {
  activePanel: SidebarPanelId;
  sidebarMode: SidebarMode | undefined;
  sidebarOpen: boolean;
};

export function parseStoredSidebarPreferences(
  raw: string | null,
): StoredSidebarPreferences {
  const fallback: StoredSidebarPreferences = {
    activePanel: DEFAULT_ACTIVE_PANEL,
    sidebarMode: undefined,
    sidebarOpen: DEFAULT_SIDEBAR_OPEN,
  };

  if (!raw) return fallback;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null) return fallback;

    const { activePanel, sidebarMode, sidebarOpen } = parsed as Record<
      string,
      unknown
    >;

    return {
      activePanel: isSidebarPanelId(activePanel)
        ? activePanel
        : fallback.activePanel,
      sidebarMode: isSidebarMode(sidebarMode) ? sidebarMode : undefined,
      sidebarOpen:
        typeof sidebarOpen === "boolean" ? sidebarOpen : fallback.sidebarOpen,
    };
  } catch {
    return fallback;
  }
}

export const sidebarInitializerScript = String.raw`
(() => {
  let sidebarOpen = ${DEFAULT_SIDEBAR_OPEN};

  try {
    const raw = window.localStorage.getItem("${SIDEBAR_STORAGE_KEY}");
    const stored = raw ? JSON.parse(raw) : null;

    if (stored && typeof stored.sidebarOpen === "boolean") {
      sidebarOpen = stored.sidebarOpen;
    }
  } catch {}

  document.documentElement.dataset.sidebarOpen = String(sidebarOpen);
})();
`.trim();
