// Not re-exported from index.ts: the root layout, a Server Component, imports
// that entry point, and this hook may only load in client modules.
import { useSyncExternalStore } from "react";

import {
  getMotionPreferenceSnapshot,
  getServerMotionPreferenceSnapshot,
  setMotionPreference,
  subscribeToMotionPreference,
} from "./motion-store";

export function useMotionPreference() {
  const preference = useSyncExternalStore(
    subscribeToMotionPreference,
    getMotionPreferenceSnapshot,
    getServerMotionPreferenceSnapshot,
  );

  return {
    reduceMotion: preference === "reduce",
    setReduceMotion: (reduce: boolean) =>
      setMotionPreference(reduce ? "reduce" : "device"),
  };
}
