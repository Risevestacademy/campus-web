import { type Participant, type Presence, spaceNameOf } from "@/core/presence";

import type {
  Meeting,
  MeetingTileLayout,
  OpenedMeetingLayout,
} from "../../types/active-campus.types";
import { meetingParticipantOf } from "./participant-identity";

type MeetingPresence = Pick<
  Presence,
  | "selfId"
  | "participants"
  | "meetingRoster"
  | "encounter"
  | "hearing"
  | "spaceNames"
>;

function rosterParticipants({
  participants,
  meetingRoster,
}: MeetingPresence): Participant[] {
  return meetingRoster.flatMap((userId) => {
    const participant = participants.get(userId);
    return participant ? [participant] : [];
  });
}

export function selectMeeting(presence: MeetingPresence): Meeting | null {
  const self =
    presence.selfId === null
      ? undefined
      : presence.participants.get(presence.selfId);
  const others = rosterParticipants(presence);
  if (!self || others.length === 0) return null;

  const inRoom = presence.hearing === "room";
  return {
    encounter: presence.encounter,
    hearing: inRoom ? "room" : "proximity",
    title: inRoom ? spaceNameOf(presence, self.spaceKey) : "Nearby",
    localParticipantId: self.userId,
    participants: [self, ...others].map(meetingParticipantOf),
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
  meeting: Meeting,
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
