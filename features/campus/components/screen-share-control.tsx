"use client";

import { MonitorArrowUpIcon } from "@phosphor-icons/react/dist/ssr/MonitorArrowUp";

import { Button } from "@/shared/ui/button";

import { useMeeting } from "../hooks/use-meeting";
import { useScreenCaptureSupported } from "../hooks/use-screen-capture-supported";
import { useMediaSession } from "../services/media-session/media-session-provider";

type ScreenShareControlProps = Readonly<{
  className?: string;
  cohortId: string;
}>;

export function ScreenShareControl({
  className,
  cohortId,
}: ScreenShareControlProps) {
  const supported = useScreenCaptureSupported();
  const meeting = useMeeting(cohortId);
  const callStatus = useMediaSession((state) => state.callAudioStatus);
  const status = useMediaSession((state) => state.screenShare.status);
  const toggleScreenShare = useMediaSession((state) => state.toggleScreenShare);

  if (!supported || !meeting) return null;

  const sharing = status === "sharing";
  const label = sharing ? "Stop sharing screen" : "Share screen";

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={label}
      aria-pressed={sharing}
      title={label}
      disabled={callStatus !== "connected"}
      onClick={toggleScreenShare}
      className={className}
    >
      <MonitorArrowUpIcon aria-hidden weight={sharing ? "fill" : "regular"} />
    </Button>
  );
}
