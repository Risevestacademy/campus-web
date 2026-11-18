// Not re-exported from index.ts: the root layout, a Server Component, imports
// that entry point, and this hook may only load in client modules.
import { useSyncExternalStore } from "react";

import {
  getServerThemeSnapshot,
  getThemeSnapshot,
  subscribeToTheme,
  toggleTheme,
} from "@/shared/theme";

export function useThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const isDark = theme === "dark";

  return {
    isDark,
    label: `Switch to ${isDark ? "light" : "dark"} mode`,
    toggle: toggleTheme,
  };
}
