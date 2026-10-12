import type { ReactNode } from "react";

import { CampusOverview } from "./campus-overview";
import {
  mockActiveParticipants,
  mockOfflineParticipantCount,
} from "./mock-participants";

const CURRENT_USER_CONTEXT_LABEL = "Product Design 2026 · Student";

export function CampusOverviewPanel({
  collapseButton,
}: {
  collapseButton: ReactNode;
}) {
  return (
    <CampusOverview
      collapseButton={collapseButton}
      contextLabel={CURRENT_USER_CONTEXT_LABEL}
      offlineParticipantCount={mockOfflineParticipantCount}
      participants={mockActiveParticipants}
    />
  );
}
