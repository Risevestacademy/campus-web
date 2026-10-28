import type { Participant } from "@/core/presence";
import { initialsOf } from "@/shared/lib/initials";

import {
  type MeetingParticipant,
  PARTICIPANT_TONES,
  type ParticipantTone,
} from "../../types/active-campus.types";

const UNNAMED_PARTICIPANT = "Campus member";

function participantTone(userId: string): ParticipantTone {
  let hash = 0;
  for (const character of userId) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  }
  return PARTICIPANT_TONES[hash % PARTICIPANT_TONES.length] ?? "cobalt";
}

export function meetingParticipantOf({
  userId,
  displayName,
}: Participant): MeetingParticipant {
  return {
    id: userId,
    initials: initialsOf(displayName),
    name: displayName ?? UNNAMED_PARTICIPANT,
    tone: participantTone(userId),
  };
}
