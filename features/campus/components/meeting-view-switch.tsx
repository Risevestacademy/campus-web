"use client";

import { MapTrifoldIcon } from "@phosphor-icons/react/dist/ssr/MapTrifold";
import { SquaresFourIcon } from "@phosphor-icons/react/dist/ssr/SquaresFour";
import { useState, useSyncExternalStore } from "react";

import type { MeetingParticipant } from "./meeting-header";
import {
  type MeetingTileLayout,
  type MeetingTileMotionConfig,
  MeetingTiles,
} from "./meeting-tiles";
import styles from "./meeting-view-switch.module.css";

type MeetingView = "map" | "grid";

type MeetingViewState = Readonly<{
  layout: MeetingTileLayout;
  shouldAnimate: boolean;
}>;

const INITIAL_MEETING_VIEW_STATE: MeetingViewState = {
  layout: { mode: "compact" },
  shouldAnimate: true,
};

interface MeetingViewSwitchControlProps {
  activeView: MeetingView;
  onActiveViewChange: (view: MeetingView, shouldAnimate: boolean) => void;
}

interface MeetingViewControlsProps {
  motionConfig?: MeetingTileMotionConfig;
  participants: readonly MeetingParticipant[];
  onViewChange?: (view: MeetingView) => void;
  subscribeToSidebarOpen?: (onStoreChange: () => void) => () => void;
  getSidebarOpenSnapshot?: () => boolean;
  getServerSidebarOpenSnapshot?: () => boolean;
}

const noSidebarSubscription = () => () => {};
const assumeSidebarOpen = () => true;

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
  motionConfig,
  participants,
  onViewChange,
  subscribeToSidebarOpen = noSidebarSubscription,
  getSidebarOpenSnapshot = assumeSidebarOpen,
  getServerSidebarOpenSnapshot = assumeSidebarOpen,
}: MeetingViewControlsProps) {
  const [viewState, setViewState] = useState<MeetingViewState>(
    INITIAL_MEETING_VIEW_STATE,
  );
  const activeView = viewState.layout.mode === "compact" ? "map" : "grid";

  const isSidebarOpen = useSyncExternalStore(
    subscribeToSidebarOpen,
    getSidebarOpenSnapshot,
    getServerSidebarOpenSnapshot,
  );
  const [sidebarOpenAtLastRender, setSidebarOpenAtLastRender] =
    useState(isSidebarOpen);

  if (isSidebarOpen !== sidebarOpenAtLastRender) {
    setSidebarOpenAtLastRender(isSidebarOpen);

    if (isSidebarOpen && viewState.layout.mode !== "compact") {
      setViewState({ layout: { mode: "compact" }, shouldAnimate: true });
    }
  }

  function updateActiveView(nextView: MeetingView, animateViewChange: boolean) {
    setViewState({
      layout:
        nextView === "map"
          ? { mode: "compact" }
          : { mode: "expanded", focusedTileId: null },
      shouldAnimate: animateViewChange,
    });
    onViewChange?.(nextView);
  }

  function activateParticipantTile(
    participantId: MeetingParticipant["id"],
    animateViewChange: boolean,
  ) {
    setViewState((currentState) => {
      if (currentState.layout.mode === "compact") {
        return {
          layout: { mode: "expanded", focusedTileId: null },
          shouldAnimate: animateViewChange,
        };
      }

      return {
        layout: {
          mode: "expanded",
          focusedTileId:
            currentState.layout.focusedTileId === participantId
              ? null
              : participantId,
        },
        shouldAnimate: animateViewChange,
      };
    });
    onViewChange?.("grid");
  }

  return (
    <>
      <MeetingTiles
        layout={viewState.layout}
        motionConfig={motionConfig}
        onTileActivate={activateParticipantTile}
        participants={participants}
        shouldAnimate={viewState.shouldAnimate}
      />
      <MeetingViewSwitchControl
        activeView={activeView}
        onActiveViewChange={updateActiveView}
      />
    </>
  );
}
