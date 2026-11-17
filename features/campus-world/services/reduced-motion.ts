import { getMotionPreferenceSnapshot } from "@/shared/motion";

// The member's own Reduce motion choice (Settings > Appearance) counts as well
// as the operating-system setting. Read on every call, so a change applies to
// the next camera glide or avatar step.
export function prefersReducedMotion(): boolean {
  if (getMotionPreferenceSnapshot() === "reduce") return true;

  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
