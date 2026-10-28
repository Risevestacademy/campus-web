import type { Participant, Presence } from "@/core/presence";

import type {
  MeetingTileLayout,
  OpenedMeetingLayout,
  ProximityMeeting,
} from "../../types/active-campus.types";
import { meetingParticipantOf } from "./participant-identity";

type ProximityPresence = Pick<
  Presence,
  "selfId" | "participants" | "nearby" | "encounter"
>;

function knownNearby({
  participants,
  nearby,
}: ProximityPresence): Participant[] {
  return nearby.flatMap((userId) => {
    const participant = participants.get(userId);
    return participant ? [participant] : [];
  });
}

export function selectProximityMeeting(
  presence: ProximityPresence,
): ProximityMeeting | null {
  const self =
    presence.selfId === null
      ? undefined
      : presence.participants.get(presence.selfId);
  const near = knownNearby(presence);
  if (!self || near.length === 0) return null;

  return {
    encounter: presence.encounter,
    localParticipantId: self.userId,
    participants: [self, ...near].map(meetingParticipantOf),
  };
}

export function splitAtCap<Item>(
  items: readonly Item[],
  cap: number,
): { shown: Item[]; remaining: number } {
  return {
    shown: items.slice(0, cap),
    remaining: Math.max(0, items.length - cap),
  };
}

export function visibleMeetingLayout(
  layout: OpenedMeetingLayout,
  meeting: ProximityMeeting,
): MeetingTileLayout {
  if (layout.mode === "compact" || layout.encounter !== meeting.encounter) {
    return { mode: "compact" };
  }

  const focusIsNear = meeting.participants.some(
    ({ id }) => id === layout.focusedTileId,
  );
  return {
    mode: "expanded",
    focusedTileId: focusIsNear ? layout.focusedTileId : null,
  };
}
