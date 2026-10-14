"use client";

import type { ReactNode } from "react";

import { PresenceSessionProvider } from "../services/presence-session/presence-session-provider";
import { RemoteAudioOutput } from "./remote-audio-output";

export function PresenceSession({
  children,
  cohortId,
}: Readonly<{ children: ReactNode; cohortId: string }>) {
  return (
    <PresenceSessionProvider cohortId={cohortId}>
      {children}
      <RemoteAudioOutput />
    </PresenceSessionProvider>
  );
}
