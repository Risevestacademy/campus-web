// Not re-exported from index.ts: the root layout, a Server Component, imports
// that entry point, and this hook may only load in client modules.
import { useSyncExternalStore } from "react";

import {
  getServerThemePreferenceSnapshot,
  getThemePreferenceSnapshot,
  setThemePreference,
  subscribeToTheme,
} from "@/shared/theme";

export function useThemePreference() {
  const preference = useSyncExternalStore(
    subscribeToTheme,
    getThemePreferenceSnapshot,
    getServerThemePreferenceSnapshot,
  );

  return { preference, setPreference: setThemePreference };
}
