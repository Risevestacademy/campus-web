"use client";

import { AnimatePresence } from "motion/react";

import { useProximityMeeting } from "../hooks/use-proximity-meeting";
import { MeetingHeader } from "./meeting-header";
import { MeetingViewControls } from "./meeting-view-switch";

export function MeetingOverlay({ cohortId }: Readonly<{ cohortId: string }>) {
  const meeting = useProximityMeeting(cohortId);

  return (
    <>
      <div className="relative z-30">
        <MeetingHeader meeting={meeting} />
      </div>
      <AnimatePresence>
        {meeting ? (
          <MeetingViewControls key="meeting-view" meeting={meeting} />
        ) : null}
      </AnimatePresence>
    </>
  );
}
