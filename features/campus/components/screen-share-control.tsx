"use client";

import { MonitorArrowUpIcon } from "@phosphor-icons/react/dist/ssr/MonitorArrowUp";
import { cn } from "cn";

import { Button } from "@/shared/ui/button";

import { useMeeting } from "../hooks/use-meeting";
import { useScreenCaptureSupported } from "../hooks/use-screen-capture-supported";
import type { CallAudioStatus } from "../services/media-session/contracts";
import { useMediaSession } from "../services/media-session/media-session-provider";

const UNAVAILABLE_REASON: Readonly<
  Record<Exclude<CallAudioStatus, "connected">, string>
> = {
  connecting: "Share screen: connecting to the call",
  idle: "Share screen: waiting for the call",
  unavailable: "Share screen: the call isn't connected",
};

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
  const unavailableReason =
    sharing || callStatus === "connected"
      ? null
      : UNAVAILABLE_REASON[callStatus];
  const label = sharing ? "Stop sharing screen" : "Share screen";

  // aria-disabled, not disabled: Button drops pointer events when disabled,
  // which would hide the title that says why.
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={label}
      aria-pressed={sharing}
      aria-disabled={unavailableReason ? true : undefined}
      title={unavailableReason ?? label}
      onClick={unavailableReason ? undefined : toggleScreenShare}
      className={cn(
        className,
        "aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:ring-0 aria-disabled:active:translate-y-0",
      )}
    >
      <MonitorArrowUpIcon aria-hidden weight={sharing ? "fill" : "regular"} />
    </Button>
  );
}
