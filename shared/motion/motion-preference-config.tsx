"use client";

// Not re-exported from index.ts, for the same reason as the hook.
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

import { useMotionPreference } from "./use-motion-preference";

// Motion components and useReducedMotionConfig follow the member's choice;
// without one they follow the operating system.
export function MotionPreferenceConfig({ children }: { children: ReactNode }) {
  const { reduceMotion } = useMotionPreference();

  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
      {children}
    </MotionConfig>
  );
}
