export const SIDEBAR_PANEL_IDS = [
  "search",
  "map",
  "chat",
  "tasks",
  "calendar",
] as const;
export type SidebarPanelId = (typeof SIDEBAR_PANEL_IDS)[number];

export const SIDEBAR_MODES = ["campus", "admin"] as const;
export type SidebarMode = (typeof SIDEBAR_MODES)[number];

export const SIDEBAR_STORAGE_KEY = "campus-sidebar";
export const SIDEBAR_CHANGE_EVENT = "campus-sidebar-change";

export const DEFAULT_ACTIVE_PANEL: SidebarPanelId = "map";
export const DEFAULT_SIDEBAR_OPEN = true;

// Inlined before hydration, where nothing can be imported: the one storage
// read that guards by hand instead of parsing with Zod.
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
