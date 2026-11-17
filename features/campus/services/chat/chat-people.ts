import { type Presence, spaceNameOf } from "@/core/presence";

import type { MeetingParticipant } from "../../types/active-campus.types";
import { selectMeeting } from "../meeting/meeting";
import { meetingParticipantOf } from "../meeting/participant-identity";

type ChatPeoplePresence = Pick<
  Presence,
  | "selfId"
  | "participants"
  | "meetingRoster"
  | "encounter"
  | "hearing"
  | "spaceNames"
>;

export type ChatPeople = Readonly<{
  // Who is here, the member first. Just the member when nobody else is.
  people: readonly MeetingParticipant[];
  localId: string | null;
  // Whom a line reaches: everyone in the space, or those standing near.
  hearing: "room" | "proximity";
  // The space's name when it is a room, null in a corridor.
  spaceName: string | null;
}>;

// The people in the meeting, which is the people the meeting view draws, or
// the member alone when nobody else is near.
export function selectChatPeople(presence: ChatPeoplePresence): ChatPeople {
  const meeting = selectMeeting(presence);
  if (meeting) {
    return {
      people: meeting.participants,
      localId: meeting.localParticipantId,
      hearing: meeting.hearing,
      spaceName: meeting.hearing === "room" ? meeting.title : null,
    };
  }

  const self =
    presence.selfId === null
      ? undefined
      : presence.participants.get(presence.selfId);
  const inRoom = presence.hearing === "room";
  return {
    people: self ? [meetingParticipantOf(self)] : [],
    localId: presence.selfId,
    hearing: inRoom ? "room" : "proximity",
    spaceName: self && inRoom ? spaceNameOf(presence, self.spaceKey) : null,
  };
}
