import {
  DEFAULT_SPACE_KEY,
  type Participant as PresenceParticipant,
  statusTimeLeft,
} from "@/core/presence";
import { avatarToneOf, initialOf } from "@/shared/lib/avatar";

import type { DirectoryPerson } from "./schemas/directory.schema";
import type { Participant, ParticipantStatus } from "./types";

const UNNAMED_MEMBER = "Campus member";

const STATUS_DETAILS: Record<ParticipantStatus, string> = {
  available: "Available",
  busy: "Busy",
  away: "Away",
};

function shownName(displayName: string | null): string {
  return displayName?.trim() || UNNAMED_MEMBER;
}

function statusOf({ status }: PresenceParticipant): ParticipantStatus {
  return status === "busy" || status === "away" ? status : "available";
}

function timedStatusOf(person: PresenceParticipant, now: number): string {
  const status = STATUS_DETAILS[statusOf(person)];
  const timeLeft = statusTimeLeft(person.statusUntil, now);
  return timeLeft ? `${status} · ${timeLeft}` : status;
}

// The roster does not show room names yet, so a room is only said to be one.
function detailOf(
  person: PresenceParticipant,
  selfId: string | null,
  now: number,
): string {
  const status = statusOf(person);
  if (person.userId === selfId) {
    return status === "available"
      ? "You"
      : `You · ${timedStatusOf(person, now)}`;
  }
  return status === "available" && person.spaceKey !== DEFAULT_SPACE_KEY
    ? "In a room"
    : timedStatusOf(person, now);
}

function rowOf(
  id: string,
  displayName: string | null,
  status: Participant["status"],
  detail: string,
): Participant {
  const name = shownName(displayName);
  return {
    id,
    name,
    initial: initialOf(name),
    avatarClassName: avatarToneOf(id),
    status,
    detail,
    isSelf: false,
  };
}

// Online rows come from the world socket, the member's own first. The
// directory lists everyone in the cohort, so whoever is not online is offline;
// without it there is no honest Offline group, so `offline` stays undefined.
export function toRosterParticipants(
  participants: ReadonlyMap<string, PresenceParticipant>,
  selfId: string | null,
  directory: readonly DirectoryPerson[] | undefined,
  now: number = Date.now(),
): { online: Participant[]; offline: Participant[] | undefined } {
  const online = [...participants.values()].map((person) => {
    return {
      ...rowOf(
        person.userId,
        person.displayName,
        statusOf(person),
        detailOf(person, selfId, now),
      ),
      isSelf: person.userId === selfId,
    };
  });
  const self = online.findIndex(({ id }) => id === selfId);
  if (self > 0) online.unshift(...online.splice(self, 1));

  let offline: Participant[] | undefined;
  if (directory) {
    const listed = new Set(participants.keys());
    offline = [];
    for (const { id, displayName } of directory) {
      if (listed.has(id)) continue;
      listed.add(id);
      offline.push(rowOf(id, displayName, "offline", ""));
    }
  }

  return { online, offline };
}
