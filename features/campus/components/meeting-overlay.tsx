"use client";

import { AnimatePresence } from "motion/react";

import { useProximityMeeting } from "../hooks/use-proximity-meeting";
import { useProximityViewShown } from "../hooks/use-proximity-view-shown";
import { MeetingHeader } from "./meeting-header";
import { MeetingViewControls } from "./meeting-view-switch";

// Mounts with the meeting, which is null whenever nobody is near, so it
// reports once per encounter.
function ProximityViewShown() {
  useProximityViewShown();
  return null;
}

export function MeetingOverlay({ cohortId }: Readonly<{ cohortId: string }>) {
  const meeting = useProximityMeeting(cohortId);

  return (
    <>
      <div className="relative z-30">
        <MeetingHeader meeting={meeting} />
      </div>
      {meeting ? <ProximityViewShown /> : null}
      <AnimatePresence>
        {meeting ? (
          <MeetingViewControls key="meeting-view" meeting={meeting} />
        ) : null}
      </AnimatePresence>
    </>
  );
}
