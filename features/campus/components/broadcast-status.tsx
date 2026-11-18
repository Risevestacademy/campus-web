"use client";

import { MegaphoneIcon } from "@phosphor-icons/react/dist/ssr/Megaphone";
import { useStore } from "zustand";

import { presenceFor } from "@/core/presence";

import { liveBroadcasts } from "../services/media-session/contracts";
import { useMediaSession } from "../services/media-session/media-session-provider";

const SPEAKERS = new Intl.ListFormat("en", {
  style: "long",
  type: "conjunction",
});

// Only admins may speak, and one with no display name is still an admin.
const UNNAMED_SPEAKER = "An admin";

// The member's own broadcast comes first, as "You".
export const OWN_SPEAKER = "You";

export function broadcastHeadline(names: readonly string[]) {
  const plural = names.length > 1 || names[0] === OWN_SPEAKER;
  return `${SPEAKERS.format(names)} ${plural ? "are" : "is"} speaking to everyone`;
}

// Shown wherever the member is while an admin speaks in the broadcast room.
// It offers no mute: a broadcast is heard over everything else.
export function BroadcastStatusView({
  speakers,
}: Readonly<{ speakers: readonly string[] }>) {
  if (speakers.length === 0) return null;

  return (
    <div className="bg-background flex items-center gap-2 rounded-2xl py-2 pr-3 pl-2.5 text-sm">
      <MegaphoneIcon aria-hidden className="text-primary size-4 shrink-0" />
      <p className="grid min-w-0">
        <span className="font-medium">Broadcast</span>
        <span className="text-foreground-secondary -mt-px truncate text-xs">
          {broadcastHeadline(speakers)}
        </span>
      </p>
    </div>
  );
}

export function BroadcastStatus({ cohortId }: Readonly<{ cohortId: string }>) {
  const broadcastPublications = useMediaSession(
    (state) => state.broadcastPublications,
  );
  const speakingYourself = useMediaSession(
    (state) => state.broadcastSpeaking === "on",
  );
  const participants = useStore(
    presenceFor(cohortId),
    (state) => state.participants,
  );
  // Presence names those in this cohort; the token's name covers an admin who
  // is not, such as a platform admin.
  const speakers = liveBroadcasts(broadcastPublications).map(
    ({ participantId, speakerName }) =>
      participants.get(participantId)?.displayName ??
      speakerName ??
      UNNAMED_SPEAKER,
  );

  return (
    <div role="status" className="empty:hidden">
      <BroadcastStatusView
        speakers={[
          ...(speakingYourself ? [OWN_SPEAKER] : []),
          ...new Set(speakers),
        ]}
      />
    </div>
  );
}
