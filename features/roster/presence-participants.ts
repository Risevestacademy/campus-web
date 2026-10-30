import type { Participant as PresenceParticipant } from "@/core/presence";

import type { DirectoryPerson } from "./schemas/directory.schema";
import type { Participant, ParticipantStatus } from "./types";

const DEFAULT_SPACE_KEY = "_default";
const UNNAMED_MEMBER = "Campus member";
// Not success, error or warning: those are the status dots beside the avatar.
export const AVATAR_TONES = [
  "bg-info-200 text-info-900",
  "bg-lemon-300 text-lemon-950",
  "bg-cobalt-300 text-cobalt-950",
  "bg-turquoise-300 text-turquoise-950",
] as const;

const STATUS_DETAILS: Record<ParticipantStatus, string> = {
  available: "Available",
  busy: "Busy",
  away: "Away",
};

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function shownName(displayName: string | null): string {
  return displayName?.trim() || UNNAMED_MEMBER;
}

// The backend sends no avatar color, so a person's own ID picks theirs: the
// same everywhere and every session, for the offline too.
function toneOf(id: string): string {
  let hash = 5381;
  for (const char of id) hash = (hash * 33 + char.codePointAt(0)!) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

function initialOf(name: string): string {
  const [first] = graphemes.segment(name);
  return first?.segment.toLocaleUpperCase() ?? "?";
}

function statusOf({ status }: PresenceParticipant): ParticipantStatus {
  return status === "busy" || status === "away" ? status : "available";
}

// Room names are not kept yet, so a room is only said to be one.
function detailOf(person: PresenceParticipant, selfId: string | null): string {
  if (person.userId === selfId) return "You";
  const status = statusOf(person);
  return status === "available" && person.spaceKey !== DEFAULT_SPACE_KEY
    ? "In a room"
    : STATUS_DETAILS[status];
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
    avatarClassName: toneOf(id),
    status,
    detail,
  };
}

// Online rows come from the world socket, the member's own first. The
// directory lists everyone in the cohort, so whoever is not online is offline;
// without it there is no honest Offline group, so `offline` stays undefined.
export function toRosterParticipants(
  participants: ReadonlyMap<string, PresenceParticipant>,
  selfId: string | null,
  directory: readonly DirectoryPerson[] | undefined,
): { online: Participant[]; offline: Participant[] | undefined } {
  const online = [...participants.values()].map((person) => {
    return rowOf(
      person.userId,
      person.displayName,
      statusOf(person),
      detailOf(person, selfId),
    );
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
