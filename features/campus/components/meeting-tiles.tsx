"use client";

import { cn } from "cn";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type { MeetingParticipant } from "./meeting-header";

type CubicBezier = [number, number, number, number];

export type MeetingTileMotionConfig = Readonly<{
  durationMs: number;
  bounce: number;
}>;

export const DEFAULT_MEETING_TILE_MOTION = {
  durationMs: 420,
  bounce: 0,
} satisfies MeetingTileMotionConfig;

export type MeetingTileLayout =
  | Readonly<{ mode: "compact" }>
  | Readonly<{
      mode: "expanded";
      focusedTileId: MeetingParticipant["id"] | null;
    }>;

export interface MeetingTilesProps {
  layout: MeetingTileLayout;
  motionConfig?: MeetingTileMotionConfig;
  onTileActivate: (
    participantId: MeetingParticipant["id"],
    shouldAnimate: boolean,
  ) => void;
  participants: readonly MeetingParticipant[];
  shouldAnimate?: boolean;
}

const OPACITY_DURATION_MS = 180;
const OPACITY_EASE: CubicBezier = [0.23, 1, 0.32, 1];

function getLayoutTransition(
  motionConfig: MeetingTileMotionConfig,
  motionDisabled: boolean,
) {
  if (motionDisabled) {
    return { duration: 0 };
  }

  const duration = motionConfig.durationMs / 1000;

  return {
    type: "spring",
    duration,
    bounce: motionConfig.bounce,
  } as const;
}

function getOpacityTransition(motionDisabled: boolean) {
  return {
    duration: motionDisabled ? 0 : OPACITY_DURATION_MS / 1000,
    ease: OPACITY_EASE,
  };
}

const opacityVariants = {
  hidden: (motionDisabled: boolean) => ({
    opacity: 0,
    transition: getOpacityTransition(motionDisabled),
  }),
  visible: (motionDisabled: boolean) => ({
    opacity: 1,
    transition: getOpacityTransition(motionDisabled),
  }),
};

export function MeetingTiles({
  layout,
  motionConfig = DEFAULT_MEETING_TILE_MOTION,
  onTileActivate,
  participants,
  shouldAnimate = true,
}: MeetingTilesProps) {
  const shouldReduceMotion = useReducedMotion();
  const motionDisabled = !shouldAnimate || Boolean(shouldReduceMotion);
  const layoutTransition = getLayoutTransition(motionConfig, motionDisabled);
  const isExpanded = layout.mode === "expanded";
  const focusedTileId = isExpanded ? layout.focusedTileId : null;
  const hasFocusedTile = focusedTileId !== null;

  return (
    <>
      <AnimatePresence initial={false} custom={motionDisabled}>
        {isExpanded ? (
          <motion.div
            key="meeting-view-backdrop"
            aria-hidden="true"
            data-testid="meeting-view-backdrop"
            custom={motionDisabled}
            variants={opacityVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed top-1.5 right-1.5 bottom-1.5 left-15 z-10 rounded-xl bg-neutral-950/25 backdrop-blur-sm"
          />
        ) : null}
      </AnimatePresence>

      <div className="flex justify-center">
        <motion.section
          aria-label="Meeting participant tiles"
          data-motion={motionDisabled ? "instant" : "animated"}
          data-surface-role="background"
          layout={!motionDisabled}
          transition={layoutTransition}
          style={{ borderRadius: 18 }}
          className={cn(
            "flex",
            isExpanded
              ? "fixed inset-x-15 top-[10dvh] bottom-[12dvh] left-30 z-20"
              : "bg-background w-fit flex-col p-1",
          )}
        >
          <motion.div
            layout={!motionDisabled}
            transition={layoutTransition}
            className={cn(
              "relative z-1 flex items-center justify-center gap-1",
              isExpanded && "size-full",
            )}
          >
            {participants.map((participant) => {
              const isFocused = focusedTileId === participant.id;
              const accessibleLabel = !isExpanded
                ? `Show expanded meeting view for ${participant.name}`
                : isFocused
                  ? "Restore equal meeting view"
                  : `Focus ${participant.name}`;

              return (
                <motion.div
                  key={participant.id}
                  layout={!motionDisabled}
                  transition={layoutTransition}
                  style={{ borderRadius: 12 }}
                  className={cn(
                    "overflow-hidden",
                    hasFocusedTile
                      ? isFocused
                        ? "order-2 h-full min-w-0 flex-1"
                        : "order-1 aspect-4/3 w-40 shrink-0"
                      : isExpanded
                        ? "h-full min-w-0 flex-1"
                        : "aspect-video w-60 shrink-0",
                  )}
                >
                  <button
                    type="button"
                    aria-label={accessibleLabel}
                    aria-pressed={isExpanded ? isFocused : undefined}
                    onClick={(event) =>
                      onTileActivate(participant.id, event.detail > 0)
                    }
                    className="bg-surface focus-visible:ring-border-focus aspect-video size-full cursor-pointer appearance-none border-0 p-0 transition-transform duration-150 outline-none focus-visible:ring-2 active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
                  />
                </motion.div>
              );
            })}
          </motion.div>

          <AnimatePresence
            initial={false}
            mode="popLayout"
            custom={motionDisabled}
          >
            {isExpanded ? null : (
              <motion.p
                key="meeting-description"
                custom={motionDisabled}
                variants={opacityVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="px-2 pt-1.25 pb-0.5 text-center text-xs"
              >
                Description for meeting
              </motion.p>
            )}
          </AnimatePresence>
        </motion.section>
      </div>
    </>
  );
}
