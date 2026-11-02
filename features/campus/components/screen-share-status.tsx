"use client";

import { Button } from "@/shared/ui/button";

import { useMeeting } from "../hooks/use-meeting";
import { useMediaSession } from "../services/media-session/media-session-provider";

// Says who could see the screen, never who does: nobody may be watching yet.
const POSSIBLE_REACH = {
  proximity: "Anyone near you can see it",
  room: "Anyone in this space can see it",
} as const;

export function ScreenShareStatus({
  cohortId,
}: Readonly<{ cohortId: string }>) {
  const meeting = useMeeting(cohortId);
  const status = useMediaSession((state) => state.screenShare.status);
  const toggleScreenShare = useMediaSession((state) => state.toggleScreenShare);

  if (status !== "sharing" || !meeting) return null;

  return (
    <div className="bg-background flex items-center gap-2 rounded-2xl py-2 pr-2 pl-2.5 text-sm">
      <p className="grid">
        <span className="font-medium">Sharing your screen</span>
        <span className="text-foreground-secondary -mt-px text-xs">
          {POSSIBLE_REACH[meeting.hearing]}
        </span>
      </p>
      <Button
        type="button"
        size="xs"
        variant="outline"
        onClick={toggleScreenShare}
        aria-label="Stop sharing"
      >
        Stop
      </Button>
    </div>
  );
}
