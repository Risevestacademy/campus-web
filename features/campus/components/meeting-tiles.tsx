"use client";

import { MicrophoneIcon } from "@phosphor-icons/react/dist/ssr/Microphone";
import { MicrophoneSlashIcon } from "@phosphor-icons/react/dist/ssr/MicrophoneSlash";
import { cn } from "cn";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { useId } from "react";

import { useMicrophoneLevelRef } from "../hooks/use-microphone-level-ref";
import { useVideoDemandRef } from "../hooks/use-video-demand-ref";
import type { VideoLayer } from "../services/media-session/contracts";
import { useMediaSession } from "../services/media-session/media-session-provider";
import {
  meetingGridShape,
  splitAtCap,
  tileVideoLayer,
} from "../services/meeting/meeting";
import { browserMicrophoneLevelMeter } from "../services/microphone-level/browser-microphone-level";
import type { MicrophoneLevelMeter } from "../services/microphone-level/microphone-level-meter";
import type {
  MeetingParticipant,
  MeetingTile,
  MeetingTileLayout,
} from "../types/active-campus.types";
import { MediaPublicationOutput } from "./media-publication-output";
import {
  EASE_IN_OUT,
  EASE_OUT,
  meetingFadeVariants,
  meetingPresenceProps,
  meetingScaleVariants,
  meetingStripVariants,
} from "./meeting-motion";
import styles from "./meeting-tiles.module.css";

export type MeetingTileMotionConfig = Readonly<{
  durationMs: number;
}>;

export const DEFAULT_MEETING_TILE_MOTION = {
  durationMs: 260,
} satisfies MeetingTileMotionConfig;

const COMPACT_TILE_CAP = 4;

export interface MeetingTilesProps {
  layout: MeetingTileLayout;
  // Hears who is speaking; tests pass their own.
  levelMeter?: MicrophoneLevelMeter;
  localParticipantId: MeetingParticipant["id"];
  motionConfig?: MeetingTileMotionConfig;
  onShowAll: (shouldAnimate: boolean) => void;
  onTileActivate: (tile: MeetingTile, shouldAnimate: boolean) => void;
  shouldAnimate?: boolean;
  tiles: readonly MeetingTile[];
}

type FallbackMotionProps = Pick<
  ComponentProps<typeof MediaPublicationOutput>,
  "wrapFallback"
>;

type ParticipantMediaProps = FallbackMotionProps &
  Readonly<{ participant: MeetingParticipant }>;

type RemoteMediaProps = ParticipantMediaProps &
  Readonly<{ videoLayer: VideoLayer }>;

const OWN_SCREEN_NAME = "Your screen";

// Only while video shows, so a waiting tile's label keeps its contrast.
const SCREEN_LETTERBOX_CLASS_NAME = "data-[video-state=visible]:bg-neutral-950";

const screenNameOf = ({ name }: MeetingParticipant) => `${name}'s screen`;

function LocalParticipantMedia({
  wrapFallback,
  participant,
}: ParticipantMediaProps) {
  const videoPublication = useMediaSession(
    (state) => state.localPublications.camera,
  );

  return (
    <MediaPublicationOutput
      fallbackClassName={participant.avatarClassName}
      fallbackInitials={participant.initial}
      wrapFallback={wrapFallback}
      label={`${participant.name} video`}
      videoPublication={videoPublication}
    />
  );
}

function RemoteParticipantMedia({
  wrapFallback,
  participant,
  videoLayer,
}: RemoteMediaProps) {
  const videoPublication = useMediaSession(
    (state) => state.remotePublications[participant.id]?.camera,
  );
  const demandRef = useVideoDemandRef(participant.id, "camera", videoLayer);

  return (
    <MediaPublicationOutput
      ref={demandRef}
      fallbackClassName={participant.avatarClassName}
      fallbackInitials={participant.initial}
      wrapFallback={wrapFallback}
      label={`${participant.name} video`}
      videoPublication={videoPublication}
    />
  );
}

function ScreenShareMedia({
  wrapFallback,
  participant,
  videoLayer,
}: RemoteMediaProps) {
  const videoPublication = useMediaSession(
    (state) => state.remotePublications[participant.id]?.screen,
  );
  const demandRef = useVideoDemandRef(participant.id, "screen", videoLayer);

  return (
    <MediaPublicationOutput
      ref={demandRef}
      className={SCREEN_LETTERBOX_CLASS_NAME}
      fallbackLabel={screenNameOf(participant)}
      wrapFallback={wrapFallback}
      fit="contain"
      label={screenNameOf(participant)}
      videoPublication={videoPublication}
    />
  );
}

function OwnScreenMedia({ wrapFallback }: FallbackMotionProps) {
  const videoPublication = useMediaSession(({ screenShare }) =>
    screenShare.status === "sharing" ? screenShare.publication : undefined,
  );

  return (
    <MediaPublicationOutput
      className={SCREEN_LETTERBOX_CLASS_NAME}
      fallbackLabel={OWN_SCREEN_NAME}
      wrapFallback={wrapFallback}
      fit="contain"
      label={OWN_SCREEN_NAME}
      videoPublication={videoPublication}
    />
  );
}

const OWN_NAME = "You";

type ParticipantVoiceProps = FallbackMotionProps &
  Readonly<{
    isLocal: boolean;
    levelMeter: MicrophoneLevelMeter;
    participant: MeetingParticipant;
    // Describes the tile's button, whose label alone would hide this.
    statusId: string;
  }>;

// A person's name and whether their microphone is on, over their video or
// avatar, and a glow while they speak. The level is read from the audio
// itself, so a muted microphone never glows.
function ParticipantVoice({
  isLocal,
  levelMeter,
  participant,
  statusId,
  wrapFallback = (nameplate) => nameplate,
}: ParticipantVoiceProps) {
  const microphone = useMediaSession((state) =>
    isLocal
      ? state.localPublications.microphone
      : state.remotePublications[participant.id]?.microphone,
  );
  const live = microphone?.enabled === true;
  const levelRef = useMicrophoneLevelRef(
    live ? microphone.track : null,
    levelMeter,
  );
  const MicIcon = live ? MicrophoneIcon : MicrophoneSlashIcon;

  return (
    <>
      <span
        ref={levelRef}
        aria-hidden="true"
        data-testid="speaking-glow"
        className="pointer-events-none absolute inset-0 rounded-[12px] opacity-0 shadow-[inset_0_0_0_2px_var(--color-success),inset_0_0_18px_color-mix(in_oklab,var(--color-success)_50%,transparent)] transition-opacity duration-150 data-[speaking=true]:opacity-100 motion-reduce:transition-none"
      />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex p-1.5">
        {wrapFallback(
          <span className="flex max-w-full min-w-0 items-center gap-1 rounded-full bg-black py-0.5 pr-2 pl-1.5 text-xs text-white">
            <MicIcon
              aria-hidden="true"
              data-microphone={live ? "on" : "off"}
              className="data-[microphone=off]:text-error data-[microphone=on]:text-success size-3.5 shrink-0"
            />
            <span id={statusId} className="sr-only">
              {live ? "Microphone on" : "Microphone off"}
            </span>
            <span className="truncate">
              {isLocal ? OWN_NAME : participant.name}
            </span>
          </span>,
        )}
      </span>
    </>
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

  return { duration: motionConfig.durationMs / 1000, ease: EASE_IN_OUT };
}

function getOpacityTransition(motionDisabled: boolean) {
  return {
    duration: motionDisabled ? 0 : OPACITY_DURATION_MS / 1000,
    ease: EASE_OUT,
  };
}

const TRAY_REVEAL_MS = 200;

// Waits for the tiles to land: the section is still grid-sized until then, so
// a tray revealed any sooner would flash as a large panel behind them.
function trayRevealStyle({
  durationMs,
}: MeetingTileMotionConfig): CSSProperties {
  return {
    transitionProperty: "clip-path, opacity",
    transitionDuration: `${TRAY_REVEAL_MS}ms`,
    transitionTimingFunction: `cubic-bezier(${EASE_OUT.join(",")})`,
    transitionDelay: `${durationMs}ms`,
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

type TileMediaProps = FallbackMotionProps &
  Readonly<{
    localParticipantId: MeetingParticipant["id"];
    tile: MeetingTile;
    videoLayer: VideoLayer;
  }>;

function TileMedia({
  wrapFallback,
  localParticipantId,
  tile,
  videoLayer,
}: TileMediaProps) {
  const { kind, participant } = tile;
  if (kind === "own-screen") {
    return <OwnScreenMedia wrapFallback={wrapFallback} />;
  }
  if (kind === "screen") {
    return (
      <ScreenShareMedia
        wrapFallback={wrapFallback}
        participant={participant}
        videoLayer={videoLayer}
      />
    );
  }
  return participant.id === localParticipantId ? (
    <LocalParticipantMedia
      wrapFallback={wrapFallback}
      participant={participant}
    />
  ) : (
    <RemoteParticipantMedia
      wrapFallback={wrapFallback}
      participant={participant}
      videoLayer={videoLayer}
    />
  );
}

function tileGeometryClassName(layout: MeetingTileLayout, isFocused: boolean) {
  if (layout.mode === "compact") return "aspect-video w-60 shrink-0";
  if (layout.focusedTileId === null) return styles.equalTile;
  return isFocused ? styles.stageTile : styles.railTile;
}

function tilesClassName(layout: MeetingTileLayout) {
  if (layout.mode === "compact") {
    return "relative z-1 flex items-center justify-center gap-1";
  }
  return cn(
    "size-full",
    layout.focusedTileId === null ? styles.equalTiles : styles.focusTiles,
  );
}

function gridShapeStyle(tileCount: number) {
  const { columns, rows } = meetingGridShape(tileCount);
  return { "--columns": columns, "--rows": rows } as CSSProperties;
}

export function MeetingTiles({
  layout,
  levelMeter = browserMicrophoneLevelMeter,
  localParticipantId,
  motionConfig = DEFAULT_MEETING_TILE_MOTION,
  onShowAll,
  onTileActivate,
  shouldAnimate = true,
  tiles,
}: MeetingTilesProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const statusIdPrefix = useId();
  const motionDisabled = !shouldAnimate || reduceMotion;
  const layoutTransition = getLayoutTransition(motionConfig, motionDisabled);
  const isExpanded = layout.mode === "expanded";
  const focusedTileId = isExpanded ? layout.focusedTileId : null;
  const { shown, remaining } = isExpanded
    ? { shown: tiles, remaining: 0 }
    : splitAtCap(tiles, COMPACT_TILE_CAP);
  const peopleCount = tiles.filter(({ kind }) => kind === "person").length;
  // A tile scales uniformly while it morphs; this holds the avatar and label at
  // their size instead of letting them pop to the tile's new scale.
  const wrapFallback = motionDisabled
    ? undefined
    : (fallback: ReactNode) => (
        <motion.div layout="position" transition={layoutTransition}>
          {fallback}
        </motion.div>
      );

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
          layout={!motionDisabled}
          transition={layoutTransition}
          style={{ borderRadius: 18 }}
          className={cn(
            "flex",
            isExpanded
              ? cn(
                  styles.expanded,
                  "fixed inset-x-15 top-[10dvh] bottom-[max(12dvh,10rem)] left-30 z-20",
                )
              : "relative w-fit flex-col overflow-hidden p-1",
          )}
        >
          <div
            aria-hidden="true"
            data-surface-role="background"
            data-testid="meeting-strip-tray"
            style={
              isExpanded || motionDisabled
                ? undefined
                : trayRevealStyle(motionConfig)
            }
            className={cn(
              "bg-background pointer-events-none absolute inset-0",
              isExpanded ? styles.trayBehindTiles : styles.trayRevealed,
            )}
          />

          <motion.div
            layoutScroll
            style={isExpanded ? gridShapeStyle(shown.length) : undefined}
            className={tilesClassName(layout)}
          >
            <AnimatePresence
              initial={false}
              mode="popLayout"
              custom={reduceMotion}
            >
              {shown.map((tile) => {
                const isFocused = focusedTileId === tile.id;
                const statusId = `${statusIdPrefix}-${tile.id}-microphone`;
                const isPerson = tile.kind === "person";

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
                      tileGeometryClassName(layout, isFocused),
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
                        aria-describedby={isPerson ? statusId : undefined}
                        onClick={(event) =>
                          onTileActivate(tile, event.detail > 0)
                        }
                        className="bg-surface relative size-full cursor-pointer appearance-none border-0 p-0 outline-none"
                      >
                        <TileMedia
                          wrapFallback={wrapFallback}
                          localParticipantId={localParticipantId}
                          tile={tile}
                          videoLayer={tileVideoLayer(layout, tile.id)}
                        />
                        {isPerson ? (
                          <ParticipantVoice
                            wrapFallback={wrapFallback}
                            isLocal={tile.participant.id === localParticipantId}
                            levelMeter={levelMeter}
                            participant={tile.participant}
                            statusId={statusId}
                          />
                        ) : null}
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
