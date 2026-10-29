import type { ReactNode } from "react";

import type { ActiveCampusViewModel } from "../types/active-campus.types";
import { CampusControlBar } from "./campus-control-bar";
import { MeetingOverlay } from "./meeting-overlay";
import { WorldConnectionStatus } from "./world-connection-status";

export function ActiveCampus({
  children,
  cohortId,
  viewModel,
  zoomControls,
}: {
  children: ReactNode;
  cohortId: string;
  viewModel: ActiveCampusViewModel;
  zoomControls: ReactNode;
}) {
  const { viewer } = viewModel;

  return (
    <div className="flex min-w-0 flex-1">
      <div className="bg-cobalt-500/10 grid flex-1 grid-rows-[auto_1fr_auto] rounded-xl">
        <div className="relative z-1">
          <aside
            id="top-actions"
            className="absolute inset-x-0 top-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1.5 p-2.5"
          >
            <MeetingOverlay cohortId={cohortId} />
          </aside>
        </div>

        {children}

        <div className="relative z-1">
          <aside
            id="bottom-actions"
            aria-label="Campus controls"
            data-layout-anchor="campus-controls"
            className="absolute inset-x-0 bottom-0 p-2.5"
          >
            <div className="absolute inset-x-0 bottom-full flex justify-center">
              <WorldConnectionStatus />
            </div>
            <CampusControlBar
              initials={viewer.initials}
              status={viewer.presenceStatus}
              zoomControls={zoomControls}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
