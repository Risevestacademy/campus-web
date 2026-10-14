"use client";

import { createContext, type ReactNode, useContext, useReducer } from "react";

import type { SidebarPanelId } from "../store/sidebar-preferences";
import {
  setActivePanel,
  setSidebarMode,
  setSidebarOpen,
} from "../store/sidebar-store";
import type { MeetingParticipant } from "../types/active-campus.types";
import type { MeetingTileLayout } from "./meeting-tiles";

type CampusViewState = Readonly<{
  meetingLayout: MeetingTileLayout;
  shouldAnimate: boolean;
}>;

type CampusViewEvent =
  | Readonly<{ type: "show-map"; shouldAnimate: boolean }>
  | Readonly<{ type: "show-grid"; shouldAnimate: boolean }>
  | Readonly<{
      type: "focus-participant";
      participantId: MeetingParticipant["id"];
      shouldAnimate: boolean;
    }>;

type CampusViewContextValue = CampusViewState &
  Readonly<{
    closeSidebar: () => void;
    focusParticipant: (
      participantId: MeetingParticipant["id"],
      shouldAnimate: boolean,
    ) => void;
    openAdministration: () => void;
    openPanel: (panelId: SidebarPanelId) => void;
    openSidebar: () => void;
    showGrid: (shouldAnimate: boolean) => void;
    showMap: (shouldAnimate: boolean) => void;
  }>;

const INITIAL_CAMPUS_VIEW_STATE: CampusViewState = {
  meetingLayout: { mode: "compact" },
  shouldAnimate: true,
};

const CampusViewContext = createContext<CampusViewContextValue | null>(null);

function reduceCampusView(
  state: CampusViewState,
  event: CampusViewEvent,
): CampusViewState {
  switch (event.type) {
    case "show-map":
      return {
        meetingLayout: { mode: "compact" },
        shouldAnimate: event.shouldAnimate,
      };
    case "show-grid":
      return {
        meetingLayout: { mode: "expanded", focusedTileId: null },
        shouldAnimate: event.shouldAnimate,
      };
    case "focus-participant":
      return {
        meetingLayout:
          state.meetingLayout.mode === "compact"
            ? { mode: "expanded", focusedTileId: null }
            : {
                mode: "expanded",
                focusedTileId:
                  state.meetingLayout.focusedTileId === event.participantId
                    ? null
                    : event.participantId,
              },
        shouldAnimate: event.shouldAnimate,
      };
  }
}

export function CampusViewProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    reduceCampusView,
    INITIAL_CAMPUS_VIEW_STATE,
  );

  function returnToMap(): void {
    dispatch({ type: "show-map", shouldAnimate: true });
  }

  const value: CampusViewContextValue = {
    ...state,
    closeSidebar: () => setSidebarOpen(false),
    focusParticipant: (participantId, shouldAnimate) => {
      dispatch({
        type: "focus-participant",
        participantId,
        shouldAnimate,
      });
      setSidebarOpen(false);
    },
    openAdministration: () => {
      returnToMap();
      setSidebarMode("admin");
    },
    openPanel: (panelId) => {
      returnToMap();
      setActivePanel(panelId);
    },
    openSidebar: () => {
      returnToMap();
      setSidebarOpen(true);
    },
    showGrid: (shouldAnimate) => {
      dispatch({ type: "show-grid", shouldAnimate });
      setSidebarOpen(false);
    },
    showMap: (shouldAnimate) => {
      dispatch({ type: "show-map", shouldAnimate });
    },
  };

  return (
    <CampusViewContext.Provider value={value}>
      {children}
    </CampusViewContext.Provider>
  );
}

export function useCampusView(): CampusViewContextValue {
  const value = useContext(CampusViewContext);

  if (value === null) {
    throw new Error("useCampusView must be used within CampusViewProvider.");
  }

  return value;
}
