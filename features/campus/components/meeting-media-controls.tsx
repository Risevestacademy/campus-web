"use client";

import { useMeeting } from "../hooks/use-meeting";
import { useMediaSession } from "../services/media-session/media-session-provider";
import { MediaControls } from "./media-controls";

type MeetingMediaControlsProps = Readonly<{
  className?: string;
  cohortId: string;
}>;

export function MeetingMediaControls({
  className,
  cohortId,
}: MeetingMediaControlsProps) {
  const meeting = useMeeting(cohortId);
  const cameraOn = useMediaSession((state) => state.camera.desiredEnabled);

  // A camera that is on stays in reach: it can outlast the meeting or predate
  // it, and hiding it then would leave capture running with no way to stop it.
  return (
    <MediaControls
      className={className}
      showCamera={Boolean(meeting) || cameraOn}
    />
  );
}
