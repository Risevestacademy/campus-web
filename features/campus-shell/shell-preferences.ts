export type SidebarPanelId = "search" | "map" | "chat" | "tasks" | "calendar";

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

export const SHELL_STORAGE_KEY = "campus-shell-ui";
export const SHELL_CHANGE_EVENT = "campus-shell-change";

export const DEFAULT_ACTIVE_PANEL: SidebarPanelId = "map";
export const DEFAULT_SIDEBAR_OPEN = true;

type StoredShellPreferences = {
  activePanel: SidebarPanelId;
  sidebarOpen: boolean;
};

export function parseStoredShellPreferences(
  raw: string | null,
): StoredShellPreferences {
  const fallback: StoredShellPreferences = {
    activePanel: DEFAULT_ACTIVE_PANEL,
    sidebarOpen: DEFAULT_SIDEBAR_OPEN,
  };

  if (!raw) return fallback;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null) return fallback;

    const { activePanel, sidebarOpen } = parsed as Record<string, unknown>;

    return {
      activePanel: isSidebarPanelId(activePanel)
        ? activePanel
        : fallback.activePanel,
      sidebarOpen:
        typeof sidebarOpen === "boolean" ? sidebarOpen : fallback.sidebarOpen,
    };
  } catch {
    return fallback;
  }
}

export const shellInitializerScript = String.raw`
(() => {
  let sidebarOpen = ${DEFAULT_SIDEBAR_OPEN};

  try {
    const raw = window.localStorage.getItem("${SHELL_STORAGE_KEY}");
    const stored = raw ? JSON.parse(raw) : null;

    if (stored && typeof stored.sidebarOpen === "boolean") {
      sidebarOpen = stored.sidebarOpen;
    }
  } catch {}

  document.documentElement.dataset.sidebarOpen = String(sidebarOpen);
})();
`.trim();
