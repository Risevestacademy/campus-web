"use client";

import { MegaphoneIcon } from "@phosphor-icons/react/dist/ssr/Megaphone";
import { cn } from "cn";
import { useStore } from "zustand";

import { presenceFor } from "@/core/presence";
import { Button } from "@/shared/ui/button";

import { useMediaSession } from "../services/media-session/media-session-provider";
import { reportSourceResult } from "./media-error-feedback";

type BroadcastControlProps = Readonly<{
  className?: string;
  cohortId: string;
}>;

// For admins only, wherever they stand: World says who may speak. Speaking
// turns the microphone on if it is off, through the member's own device.
export function BroadcastControl({
  className,
  cohortId,
}: BroadcastControlProps) {
  const canSpeak = useStore(
    presenceFor(cohortId),
    (state) => state.broadcast?.canSpeak === true,
  );
  const speaking = useMediaSession((state) => state.broadcastSpeaking === "on");
  const toggleBroadcastSpeaking = useMediaSession(
    (state) => state.toggleBroadcastSpeaking,
  );

  if (!canSpeak) return null;

  const label = speaking ? "Stop speaking to everyone" : "Speak to everyone";

  async function handleClick() {
    const failure = await toggleBroadcastSpeaking();
    if (failure) reportSourceResult("microphone", failure);
  }

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={label}
      aria-pressed={speaking}
      title={label}
      onClick={handleClick}
      className={cn(className, speaking && "text-primary")}
    >
      <MegaphoneIcon aria-hidden weight={speaking ? "fill" : "regular"} />
    </Button>
  );
}
