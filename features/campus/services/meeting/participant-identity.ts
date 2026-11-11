import type { Participant } from "@/core/presence";
import { avatarToneOf, initialOf } from "@/shared/lib/avatar";

import type { MeetingParticipant } from "../../types/active-campus.types";

const UNNAMED_PARTICIPANT = "Campus member";

export function meetingParticipantOf({
  userId,
  displayName,
}: Participant): MeetingParticipant {
  const name = displayName?.trim() || UNNAMED_PARTICIPANT;
  return {
    id: userId,
    initial: initialOf(name),
    name,
    avatarClassName: avatarToneOf(userId),
  };
}
