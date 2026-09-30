import type { Participant, ParticipantStatus } from "./types";

export type ParticipantFilterId = "all" | ParticipantStatus;

export const participantFilters: ReadonlyArray<{
  id: ParticipantFilterId;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "in-room", label: "In a room" },
  { id: "busy", label: "Busy" },
];

export function matchesParticipantFilter(
  participant: Participant,
  filter: ParticipantFilterId,
): boolean {
  return filter === "all" || participant.status === filter;
}
