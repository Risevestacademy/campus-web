"use client";

import { MapTrifoldIcon } from "@phosphor-icons/react/dist/ssr/MapTrifold";
import { SquaresFourIcon } from "@phosphor-icons/react/dist/ssr/SquaresFour";
import { motion, useIsPresent, useReducedMotion } from "motion/react";

import { visibleMeetingLayout } from "../services/proximity-meeting/proximity-meeting";
import type {
  MeetingParticipant,
  MeetingTileLayout,
  ProximityMeeting,
} from "../types/active-campus.types";
import { useCampusView } from "./campus-view-provider";
import { meetingGroupVariants, meetingPresenceProps } from "./meeting-motion";
import { type MeetingTileMotionConfig, MeetingTiles } from "./meeting-tiles";
import styles from "./meeting-view-switch.module.css";

type MeetingView = "map" | "grid";

interface MeetingViewSwitchControlProps {
  activeView: MeetingView;
  onActiveViewChange: (view: MeetingView, shouldAnimate: boolean) => void;
}

const COMPACT_LAYOUT: MeetingTileLayout = { mode: "compact" };

interface MeetingViewControlsProps {
  meeting: ProximityMeeting;
  motionConfig?: MeetingTileMotionConfig;
}

function MeetingViewIconPair() {
  return (
    <>
      <MapTrifoldIcon weight="regular" />
      <SquaresFourIcon weight="regular" />
    </>
  );
}

function MeetingViewSwitchControl({
  activeView,
  onActiveViewChange,
}: MeetingViewSwitchControlProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const switchViewTitle =
    activeView === "map" ? "Switch to grid view" : "Switch to map view";

  return (
    <motion.div
      custom={reduceMotion}
      variants={meetingGroupVariants}
      {...meetingPresenceProps}
      className={styles.switchRoot}
      data-active-view={activeView}
    >
      <span aria-hidden="true" className={styles.iconLayer}>
        <MeetingViewIconPair />
      </span>

      <span
        aria-hidden="true"
        className={`${styles.iconLayer} ${styles.selectedIconLayer}`}
      >
        <MeetingViewIconPair />
      </span>

      <button
        type="button"
        role="switch"
        aria-label="Use grid view"
        aria-checked={activeView === "grid"}
        title={switchViewTitle}
        className={styles.switchControl}
        onClick={(event) =>
          onActiveViewChange(
            activeView === "map" ? "grid" : "map",
            event.detail > 0,
          )
        }
      />
    </motion.div>
  );
}

export function MeetingViewControls({
  meeting,
  motionConfig,
}: MeetingViewControlsProps) {
  const { focusParticipant, meetingLayout, shouldAnimate, showGrid, showMap } =
    useCampusView();
  const isPresent = useIsPresent();
  // Leaving means nobody is near: collapse to the map rather than fade the
  // grid out at full size.
  const layout = isPresent
    ? visibleMeetingLayout(meetingLayout, meeting)
    : COMPACT_LAYOUT;
  const activeView = layout.mode === "compact" ? "map" : "grid";
  const { encounter } = meeting;

  function updateActiveView(nextView: MeetingView, animateViewChange: boolean) {
    if (nextView === "map") {
      showMap(animateViewChange);
    } else {
      showGrid({ encounter, shouldAnimate: animateViewChange });
    }
  }

  function activateParticipantTile(
    participantId: MeetingParticipant["id"],
    animateViewChange: boolean,
  ) {
    focusParticipant({
      participantId,
      encounter,
      shouldAnimate: animateViewChange,
    });
  }

  return (
    <>
      <MeetingTiles
        layout={layout}
        localParticipantId={meeting.localParticipantId}
        motionConfig={motionConfig}
        onShowAll={(animateViewChange) =>
          updateActiveView("grid", animateViewChange)
        }
        onTileActivate={activateParticipantTile}
        participants={meeting.participants}
        shouldAnimate={shouldAnimate}
      />
      <MeetingViewSwitchControl
        activeView={activeView}
        onActiveViewChange={updateActiveView}
      />
    </>
  );
}
