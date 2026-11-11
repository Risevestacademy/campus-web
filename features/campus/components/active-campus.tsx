import type { ReactNode } from "react";

import { CampusControlBar } from "./campus-control-bar";
import type { CampusViewer } from "./campus-shell/feedback-layer";
import { MeetingOverlay } from "./meeting-overlay";
import { ScreenShareStatus } from "./screen-share-status";
import { WorldConnectionStatus } from "./world-connection-status";

export function ActiveCampus({
  children,
  cohortId,
  viewer,
  zoomControls,
}: {
  children: ReactNode;
  cohortId: string;
  viewer: CampusViewer;
  zoomControls: ReactNode;
}) {
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
            <div className="absolute inset-x-0 bottom-full flex flex-col items-center gap-1.5">
              <WorldConnectionStatus />
              <ScreenShareStatus cohortId={cohortId} />
            </div>
            <CampusControlBar
              cohortId={cohortId}
              viewer={viewer}
              zoomControls={zoomControls}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
