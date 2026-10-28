import type { Variants } from "motion/react";

type CubicBezier = [number, number, number, number];

export const EASE_OUT: CubicBezier = [0.23, 1, 0.32, 1];

const ENTER = { duration: 0.2, ease: EASE_OUT };
const EXIT = { duration: 0.15, ease: EASE_OUT };

// Reduced motion keeps the fade, at the shorter duration, and moves nothing.
function enterTransition(reduceMotion: boolean) {
  return reduceMotion ? EXIT : ENTER;
}

// Opacity and a transform string only: the x/y/scale shorthands animate CSS
// variables on the main thread, which the map keeps busy. Transforms settle
// on none, so a transformed ancestor never re-anchors the fixed meeting grid.
// The strip contains that grid, so it leaves by fading alone.
export const meetingStripVariants: Variants = {
  entering: (reduceMotion: boolean) => ({
    opacity: 0,
    transform: reduceMotion ? "none" : "translateY(-8px) scale(0.96)",
  }),
  shown: (reduceMotion: boolean) => ({
    opacity: 1,
    transform: reduceMotion ? "none" : "translateY(0px) scale(1)",
    transition: enterTransition(reduceMotion),
    transitionEnd: { transform: "none" },
  }),
  leaving: { opacity: 0, transition: EXIT },
};

export const meetingGroupVariants: Variants = {
  ...meetingStripVariants,
  leaving: (reduceMotion: boolean) => ({
    opacity: 0,
    transform: reduceMotion ? "none" : "translateY(-4px)",
    transition: EXIT,
  }),
};

export const meetingFadeVariants: Variants = {
  entering: { opacity: 0 },
  shown: (reduceMotion: boolean) => ({
    opacity: 1,
    transition: enterTransition(reduceMotion),
  }),
  leaving: { opacity: 0, transition: EXIT },
};

export const meetingScaleVariants: Variants = {
  entering: (reduceMotion: boolean) => ({
    transform: reduceMotion ? "none" : "scale(0.95)",
  }),
  shown: (reduceMotion: boolean) => ({
    transform: reduceMotion ? "none" : "scale(1)",
    transition: enterTransition(reduceMotion),
    transitionEnd: { transform: "none" },
  }),
  leaving: (reduceMotion: boolean) => ({
    transform: reduceMotion ? "none" : "scale(0.95)",
    transition: EXIT,
  }),
};

export const meetingPresenceProps = {
  initial: "entering",
  animate: "shown",
  exit: "leaving",
} as const;
