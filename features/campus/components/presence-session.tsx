"use client";

import type { ReactNode } from "react";

import { useCallAudioFeedback } from "../hooks/use-call-audio-feedback";
import { useCameraPublishFeedback } from "../hooks/use-camera-publish-feedback";
import { PresenceSessionProvider } from "../services/presence-session/presence-session-provider";
import { RemoteAudioOutput } from "./remote-audio-output";

// Once per Presence Session, beside its audio: the media controls render on
// several surfaces at once and must never grow to explain a failure.
export function CallMediaFeedback() {
  useCallAudioFeedback();
  useCameraPublishFeedback();
  return null;
}

export function PresenceSession({
  children,
  cohortId,
}: Readonly<{ children: ReactNode; cohortId: string }>) {
  return (
    <PresenceSessionProvider cohortId={cohortId}>
      {children}
      <RemoteAudioOutput />
      <CallMediaFeedback />
    </PresenceSessionProvider>
  );
}
