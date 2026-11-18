import { z } from "zod";

import { parseJson } from "@/shared/lib/parse-json";

import {
  DEFAULT_ACTIVE_PANEL,
  DEFAULT_SIDEBAR_OPEN,
  SIDEBAR_MODES,
  SIDEBAR_PANEL_IDS,
} from "../store/sidebar-preferences";

// Each field falls back on its own, so one bad value keeps the others.
const storedSidebarPreferencesSchema = z.object({
  activePanel: z.enum(SIDEBAR_PANEL_IDS).catch(DEFAULT_ACTIVE_PANEL),
  sidebarMode: z.enum(SIDEBAR_MODES).optional().catch(undefined),
  sidebarOpen: z.boolean().catch(DEFAULT_SIDEBAR_OPEN),
});

export type StoredSidebarPreferences = z.output<
  typeof storedSidebarPreferencesSchema
>;

const DEFAULT_SIDEBAR_PREFERENCES: StoredSidebarPreferences = {
  activePanel: DEFAULT_ACTIVE_PANEL,
  sidebarMode: undefined,
  sidebarOpen: DEFAULT_SIDEBAR_OPEN,
};

export function parseStoredSidebarPreferences(
  raw: string | null,
): StoredSidebarPreferences {
  return (
    parseJson(storedSidebarPreferencesSchema, raw) ??
    DEFAULT_SIDEBAR_PREFERENCES
  );
}
