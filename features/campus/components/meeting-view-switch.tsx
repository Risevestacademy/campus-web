"use client";

import { MapTrifoldIcon } from "@phosphor-icons/react/dist/ssr/MapTrifold";
import { SquaresFourIcon } from "@phosphor-icons/react/dist/ssr/SquaresFour";

import type { MeetingParticipant } from "../types/active-campus.types";
import { useCampusView } from "./campus-view-provider";
import { type MeetingTileMotionConfig, MeetingTiles } from "./meeting-tiles";
import styles from "./meeting-view-switch.module.css";

type MeetingView = "map" | "grid";

interface MeetingViewSwitchControlProps {
  activeView: MeetingView;
  onActiveViewChange: (view: MeetingView, shouldAnimate: boolean) => void;
}

interface MeetingViewControlsProps {
  localParticipantId: MeetingParticipant["id"];
  motionConfig?: MeetingTileMotionConfig;
  participants: readonly MeetingParticipant[];
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
  const switchViewTitle =
    activeView === "map" ? "Switch to grid view" : "Switch to map view";

  return (
    <div className={styles.switchRoot} data-active-view={activeView}>
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
    </div>
  );
}

export function MeetingViewControls({
  localParticipantId,
  motionConfig,
  participants,
}: MeetingViewControlsProps) {
  const { focusParticipant, meetingLayout, shouldAnimate, showGrid, showMap } =
    useCampusView();
  const activeView = meetingLayout.mode === "compact" ? "map" : "grid";

  function updateActiveView(nextView: MeetingView, animateViewChange: boolean) {
    if (nextView === "map") {
      showMap(animateViewChange);
    } else {
      showGrid(animateViewChange);
    }
  }

  function activateParticipantTile(
    participantId: MeetingParticipant["id"],
    animateViewChange: boolean,
  ) {
    focusParticipant(participantId, animateViewChange);
  }

  return (
    <>
      <MeetingTiles
        layout={meetingLayout}
        localParticipantId={localParticipantId}
        motionConfig={motionConfig}
        onTileActivate={activateParticipantTile}
        participants={participants}
        shouldAnimate={shouldAnimate}
      />
      <MeetingViewSwitchControl
        activeView={activeView}
        onActiveViewChange={updateActiveView}
      />
    </>
  );
}
