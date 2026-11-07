"use client";

import { type ReactNode, useMemo } from "react";
import { useStore } from "zustand";

import { presenceFor } from "@/core/presence";

import { CampusOverview } from "./campus-overview";
import { contextLabelFor } from "./context-label";
import { useCohortDirectory } from "./hooks/use-cohort-directory";
import { useGoToParticipant } from "./hooks/use-go-to-participant";
import { useGoToSpace } from "./hooks/use-go-to-space";
import { useGoToTile } from "./hooks/use-go-to-tile";
import { toRosterParticipants } from "./presence-participants";
import { quickTransportDestinationsOf } from "./quick-transport";
import type { CohortContext } from "./types";

export function CampusOverviewPanel({
  cohort,
  cohortId,
  collapseButton,
}: {
  cohort?: CohortContext;
  cohortId: string;
  collapseButton: ReactNode;
}) {
  const presence = presenceFor(cohortId);
  const participants = useStore(presence, (state) => state.participants);
  const selfId = useStore(presence, (state) => state.selfId);
  const spaceNames = useStore(presence, (state) => state.spaceNames);
  const map = useStore(presence, (state) => state.map);
  // Until a current snapshot arrives nobody is known to be online, so the
  // whole directory would read as offline. After a reconnect the map is kept
  // but the old snapshot is not current.
  const hasSnapshot = useStore(presence, (state) => state.synced);
  const directory = useCohortDirectory(cohortId);
  const goToParticipant = useGoToParticipant(cohortId);
  const goToSpace = useGoToSpace(cohortId);
  const goToTile = useGoToTile(cohortId);
  const destinations = useMemo(
    () => quickTransportDestinationsOf({ map, spaceNames }),
    [map, spaceNames],
  );

  const { online, offline } = useMemo(
    () =>
      toRosterParticipants(
        participants,
        selfId,
        hasSnapshot && directory?.kind === "loaded"
          ? directory.people
          : undefined,
      ),
    [participants, selfId, hasSnapshot, directory],
  );

  return (
    <CampusOverview
      collapseButton={collapseButton}
      contextLabel={contextLabelFor(cohort)}
      offlineParticipants={offline}
      onParticipantAction={(action, participant) => {
        if (action === "go-to") goToParticipant(participant.id);
      }}
      onQuickTransport={({ to }) =>
        to.kind === "space" ? goToSpace(to.spaceKey) : goToTile(to)
      }
      participants={online}
      quickTransportDestinations={destinations}
    />
  );
}
