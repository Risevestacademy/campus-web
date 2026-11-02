"use client";

import { cn } from "cn";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { useVideoDemandRef } from "../hooks/use-video-demand-ref";
import type { VideoLayer } from "../services/media-session/contracts";
import { useMediaSession } from "../services/media-session/media-session-provider";
import { splitAtCap, tileVideoLayer } from "../services/meeting/meeting";
import type {
  MeetingParticipant,
  MeetingTile,
  MeetingTileLayout,
} from "../types/active-campus.types";
import { MediaPublicationOutput } from "./media-publication-output";
import {
  EASE_OUT,
  meetingFadeVariants,
  meetingPresenceProps,
  meetingScaleVariants,
  meetingStripVariants,
} from "./meeting-motion";
import { participantToneClassNames } from "./participant-tone";

export type MeetingTileMotionConfig = Readonly<{
  durationMs: number;
  bounce: number;
}>;

export const DEFAULT_MEETING_TILE_MOTION = {
  durationMs: 420,
  bounce: 0,
} satisfies MeetingTileMotionConfig;

const COMPACT_TILE_CAP = 4;

export interface MeetingTilesProps {
  layout: MeetingTileLayout;
  localParticipantId: MeetingParticipant["id"];
  motionConfig?: MeetingTileMotionConfig;
  onShowAll: (shouldAnimate: boolean) => void;
  onTileActivate: (tile: MeetingTile, shouldAnimate: boolean) => void;
  shouldAnimate?: boolean;
  tiles: readonly MeetingTile[];
}

type ParticipantMediaProps = Readonly<{ participant: MeetingParticipant }>;

type RemoteMediaProps = ParticipantMediaProps &
  Readonly<{ videoLayer: VideoLayer }>;

const OWN_SCREEN_NAME = "Your screen";

const screenNameOf = ({ name }: MeetingParticipant) => `${name}'s screen`;

function LocalParticipantMedia({ participant }: ParticipantMediaProps) {
  const videoPublication = useMediaSession(
    (state) => state.localPublications.camera,
  );

  return (
    <MediaPublicationOutput
      fallbackClassName={participantToneClassNames[participant.tone]}
      fallbackInitials={participant.initials}
      fallbackLabel="You"
      label={`${participant.name} video`}
      videoPublication={videoPublication}
    />
  );
}

function RemoteParticipantMedia({ participant, videoLayer }: RemoteMediaProps) {
  const videoPublication = useMediaSession(
    (state) => state.remotePublications[participant.id]?.camera,
  );
  const demandRef = useVideoDemandRef(participant.id, "camera", videoLayer);

  return (
    <MediaPublicationOutput
      ref={demandRef}
      fallbackClassName={participantToneClassNames[participant.tone]}
      fallbackInitials={participant.initials}
      fallbackLabel={participant.name}
      label={`${participant.name} video`}
      videoPublication={videoPublication}
    />
  );
}

function ScreenShareMedia({ participant, videoLayer }: RemoteMediaProps) {
  const videoPublication = useMediaSession(
    (state) => state.remotePublications[participant.id]?.screen,
  );
  const demandRef = useVideoDemandRef(participant.id, "screen", videoLayer);

  return (
    <MediaPublicationOutput
      ref={demandRef}
      fallbackLabel={screenNameOf(participant)}
      fit="contain"
      label={screenNameOf(participant)}
      videoPublication={videoPublication}
    />
  );
}

function OwnScreenMedia() {
  const videoPublication = useMediaSession(({ screenShare }) =>
    screenShare.status === "sharing" ? screenShare.publication : undefined,
  );

  return (
    <MediaPublicationOutput
      fallbackLabel={OWN_SCREEN_NAME}
      fit="contain"
      label={OWN_SCREEN_NAME}
      videoPublication={videoPublication}
    />
  );
}

const OPACITY_DURATION_MS = 180;

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
    ease: EASE_OUT,
  };
}

const backdropVariants = {
  hidden: (motionDisabled: boolean) => ({
    opacity: 0,
    transition: getOpacityTransition(motionDisabled),
  }),
  visible: (motionDisabled: boolean) => ({
    opacity: 1,
    transition: getOpacityTransition(motionDisabled),
  }),
};

function tileNameOf({ kind, participant }: MeetingTile): string {
  if (kind === "own-screen") return OWN_SCREEN_NAME;
  return kind === "screen" ? screenNameOf(participant) : participant.name;
}

function tileLabel(
  tile: MeetingTile,
  isExpanded: boolean,
  isFocused: boolean,
): string {
  const name = tileNameOf(tile);
  if (!isExpanded) return `Show expanded meeting view for ${name}`;
  return isFocused ? "Restore equal meeting view" : `Focus ${name}`;
}

type TileMediaProps = Readonly<{
  localParticipantId: MeetingParticipant["id"];
  tile: MeetingTile;
  videoLayer: VideoLayer;
}>;

function TileMedia({ localParticipantId, tile, videoLayer }: TileMediaProps) {
  const { kind, participant } = tile;
  if (kind === "own-screen") return <OwnScreenMedia />;
  if (kind === "screen") {
    return (
      <ScreenShareMedia participant={participant} videoLayer={videoLayer} />
    );
  }
  return participant.id === localParticipantId ? (
    <LocalParticipantMedia participant={participant} />
  ) : (
    <RemoteParticipantMedia participant={participant} videoLayer={videoLayer} />
  );
}

export function MeetingTiles({
  layout,
  localParticipantId,
  motionConfig = DEFAULT_MEETING_TILE_MOTION,
  onShowAll,
  onTileActivate,
  shouldAnimate = true,
  tiles,
}: MeetingTilesProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const motionDisabled = !shouldAnimate || reduceMotion;
  const layoutTransition = getLayoutTransition(motionConfig, motionDisabled);
  const isExpanded = layout.mode === "expanded";
  const focusedTileId = isExpanded ? layout.focusedTileId : null;
  const hasFocusedTile = focusedTileId !== null;
  const { shown, remaining } = isExpanded
    ? { shown: tiles, remaining: 0 }
    : splitAtCap(tiles, COMPACT_TILE_CAP);
  const peopleCount = tiles.filter(({ kind }) => kind === "person").length;

  return (
    <>
      <AnimatePresence initial={false} custom={motionDisabled}>
        {isExpanded ? (
          <motion.div
            key="meeting-view-backdrop"
            aria-hidden="true"
            data-testid="meeting-view-backdrop"
            custom={motionDisabled}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed top-1.5 right-1.5 bottom-1.5 left-15 z-10 rounded-xl bg-neutral-950/25 backdrop-blur-sm"
          />
        ) : null}
      </AnimatePresence>

      <motion.div
        custom={reduceMotion}
        variants={meetingStripVariants}
        {...meetingPresenceProps}
        className="flex justify-center"
      >
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
              : "bg-background w-fit flex-col overflow-hidden p-1",
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
            <AnimatePresence
              initial={false}
              mode="popLayout"
              custom={reduceMotion}
            >
              {shown.map((tile) => {
                const isFocused = focusedTileId === tile.id;

                return (
                  <motion.div
                    key={tile.id}
                    data-testid="meeting-tile"
                    layout={!motionDisabled}
                    transition={layoutTransition}
                    custom={reduceMotion}
                    variants={meetingFadeVariants}
                    {...meetingPresenceProps}
                    style={{ borderRadius: 12 }}
                    className={cn(
                      "has-[:focus-visible]:ring-border-focus overflow-hidden has-[:focus-visible]:ring-2",
                      hasFocusedTile
                        ? isFocused
                          ? "order-2 h-full min-w-0 flex-1"
                          : "order-1 aspect-4/3 w-40 shrink-0"
                        : isExpanded
                          ? "h-full min-w-0 flex-1"
                          : "aspect-video w-60 shrink-0",
                    )}
                  >
                    <motion.div
                      custom={reduceMotion}
                      variants={meetingScaleVariants}
                      className="size-full"
                    >
                      <button
                        type="button"
                        aria-label={tileLabel(tile, isExpanded, isFocused)}
                        aria-pressed={isExpanded ? isFocused : undefined}
                        onClick={(event) =>
                          onTileActivate(tile, event.detail > 0)
                        }
                        className="bg-surface aspect-video size-full cursor-pointer appearance-none border-0 p-0 transition-transform duration-150 outline-none active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
                      >
                        <TileMedia
                          localParticipantId={localParticipantId}
                          tile={tile}
                          videoLayer={tileVideoLayer(layout, tile.id)}
                        />
                      </button>
                    </motion.div>
                  </motion.div>
                );
              })}

              {remaining > 0 ? (
                <motion.button
                  key="more-participants"
                  type="button"
                  layout={!motionDisabled}
                  transition={layoutTransition}
                  custom={reduceMotion}
                  variants={meetingFadeVariants}
                  {...meetingPresenceProps}
                  aria-label={`Show all ${peopleCount} participants`}
                  onClick={(event) => onShowAll(event.detail > 0)}
                  style={{ borderRadius: 12 }}
                  className="bg-surface text-foreground-secondary focus-visible:ring-border-focus grid aspect-video w-24 shrink-0 cursor-pointer place-items-center text-sm font-medium outline-none focus-visible:ring-2"
                >
                  +{remaining}
                </motion.button>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </motion.section>
      </motion.div>
    </>
  );
}
