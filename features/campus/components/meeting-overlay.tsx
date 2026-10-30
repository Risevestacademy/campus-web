"use client";

import { AnimatePresence } from "motion/react";

import type { Hearing } from "@/core/presence";

import { useMeeting } from "../hooks/use-meeting";
import { useProximityViewShown } from "../hooks/use-proximity-view-shown";
import { MeetingHeader } from "./meeting-header";
import { MeetingViewControls } from "./meeting-view-switch";

// Keyed by encounter, so it reports once per encounter even when the frame
// that empties one meeting and the frame that starts the next render together.
function ProximityViewShown({ hearing }: Readonly<{ hearing: Hearing }>) {
  useProximityViewShown(hearing);
  return null;
}

export function MeetingOverlay({ cohortId }: Readonly<{ cohortId: string }>) {
  const meeting = useMeeting(cohortId);

  return (
    <>
      <div className="relative z-30">
        <MeetingHeader meeting={meeting} />
      </div>
      {meeting ? (
        <ProximityViewShown key={meeting.encounter} hearing={meeting.hearing} />
      ) : null}
      <AnimatePresence>
        {meeting ? (
          <MeetingViewControls key="meeting-view" meeting={meeting} />
        ) : null}
      </AnimatePresence>
    </>
  );
}
