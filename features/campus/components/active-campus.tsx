import type { ReactNode } from "react";

import type { ActiveCampusViewModel } from "../types/active-campus.types";
import { CampusControlBar } from "./campus-control-bar";
import { MeetingHeader } from "./meeting-header";
import { MeetingViewControls } from "./meeting-view-switch";

export function ActiveCampus({
  children,
  viewModel,
}: {
  children: ReactNode;
  viewModel: ActiveCampusViewModel;
}) {
  const { meeting, viewer } = viewModel;

  return (
    <div className="flex min-w-0 flex-1">
      <div className="bg-cobalt-500/10 grid flex-1 grid-rows-[auto_1fr_auto] rounded-xl">
        <div className="relative z-1">
          <aside
            id="top-actions"
            className="absolute inset-x-0 top-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-1.5 p-2.5"
          >
            <div className="relative z-30">
              <MeetingHeader
                title={meeting.title}
                participants={meeting.participants}
                remainingParticipantCount={meeting.remainingParticipantCount}
              />
            </div>
            <MeetingViewControls
              localParticipantId={meeting.localParticipantId}
              participants={meeting.participants}
            />
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
            <CampusControlBar
              initials={viewer.initials}
              status={viewer.presenceStatus}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
