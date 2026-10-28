"use client";

import { createContext, type ReactNode, useContext, useReducer } from "react";

import type { SidebarPanelId } from "../store/sidebar-preferences";
import {
  setActivePanel,
  setSidebarMode,
  setSidebarOpen,
} from "../store/sidebar-store";
import type {
  MeetingParticipant,
  OpenedMeetingLayout,
} from "../types/active-campus.types";

type CampusViewState = Readonly<{
  meetingLayout: OpenedMeetingLayout;
  shouldAnimate: boolean;
}>;

type GridRequest = Readonly<{ encounter: number; shouldAnimate: boolean }>;

type FocusRequest = GridRequest &
  Readonly<{ participantId: MeetingParticipant["id"] }>;

type CampusViewEvent =
  | Readonly<{ type: "show-map"; shouldAnimate: boolean }>
  | (Readonly<{ type: "show-grid" }> & GridRequest)
  | (Readonly<{ type: "focus-participant" }> & FocusRequest);

type CampusViewContextValue = CampusViewState &
  Readonly<{
    closeSidebar: () => void;
    focusParticipant: (focus: FocusRequest) => void;
    openAdministration: () => void;
    openPanel: (panelId: SidebarPanelId) => void;
    openSidebar: () => void;
    showGrid: (grid: GridRequest) => void;
    showMap: (shouldAnimate: boolean) => void;
  }>;

const INITIAL_CAMPUS_VIEW_STATE: CampusViewState = {
  meetingLayout: { mode: "compact" },
  shouldAnimate: true,
};

const CampusViewContext = createContext<CampusViewContextValue | null>(null);

// A grid from an earlier encounter counts as closed, so a tile pressed on the
// map opens a fresh one instead of toggling a focus nobody can see.
function nextFocus(
  layout: OpenedMeetingLayout,
  { encounter, participantId }: FocusRequest,
): MeetingParticipant["id"] | null {
  const gridIsOpen =
    layout.mode === "expanded" && layout.encounter === encounter;
  if (!gridIsOpen) return null;
  return layout.focusedTileId === participantId ? null : participantId;
}

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
        meetingLayout: {
          mode: "expanded",
          focusedTileId: null,
          encounter: event.encounter,
        },
        shouldAnimate: event.shouldAnimate,
      };
    case "focus-participant":
      return {
        meetingLayout: {
          mode: "expanded",
          focusedTileId: nextFocus(state.meetingLayout, event),
          encounter: event.encounter,
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
    focusParticipant: (focus) => {
      dispatch({ type: "focus-participant", ...focus });
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
    showGrid: (grid) => {
      dispatch({ type: "show-grid", ...grid });
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
