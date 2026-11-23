import { z } from "zod";

// "reduce" turns animation down even where the device allows it; "device"
// leaves the choice to the operating system's reduced-motion setting.
export type MotionPreference = "reduce" | "device";

export const MOTION_STORAGE_KEY = "campus-motion";
export const MOTION_CHANGE_EVENT = "campus-motion-change";
export const SERVER_MOTION_PREFERENCE: MotionPreference = "device";

const storedMotionPreferenceSchema = z
  .enum(["reduce", "device"])
  .catch("device");

export function parseMotionPreference(stored: string | null): MotionPreference {
  return storedMotionPreferenceSchema.parse(stored);
}

// Inlined before hydration, where nothing can be imported: the one storage
// read that guards by hand instead of parsing with Zod.
export const motionInitializerScript = String.raw`
(() => {
  try {
    if (window.localStorage.getItem("${MOTION_STORAGE_KEY}") === "reduce") {
      document.documentElement.dataset.motion = "reduce";
    }
  } catch {
    // Follow the operating-system setting when storage is unavailable.
  }
})();
`.trim();
