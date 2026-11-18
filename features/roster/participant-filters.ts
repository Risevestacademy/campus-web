import type { Participant, ParticipantStatus } from "./types";

export type ParticipantFilterId = "all" | ParticipantStatus;

export const participantFilters: ReadonlyArray<{
  id: ParticipantFilterId;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "busy", label: "Busy" },
  { id: "away", label: "Away" },
];

export function matchesParticipantFilter(
  participant: Participant,
  filter: ParticipantFilterId,
): boolean {
  return filter === "all" || participant.status === filter;
}
