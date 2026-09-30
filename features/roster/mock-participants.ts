import type { Participant } from "./types";

/**
 * Placeholder roster until the presence API exists. Avatar colors are
 * temporary too — pending the real avatar design.
 */
export const mockActiveParticipants: readonly Participant[] = [
  {
    id: "ayobami",
    name: "Ayobami",
    initial: "A",
    avatarClassName: "bg-info-200 text-info-900",
    status: "available",
    detail: "Available · Main hallway",
  },
  {
    id: "chiemezie",
    name: "Chiemezie",
    initial: "C",
    avatarClassName: "bg-lemon-300 text-lemon-950",
    status: "in-room",
    detail: "Mentor · In Pod 1",
  },
  {
    id: "victor",
    name: "Victor",
    initial: "V",
    avatarClassName: "bg-cobalt-300 text-cobalt-950",
    status: "in-room",
    detail: "In Classroom A",
  },
  {
    id: "osemen",
    name: "Osemen",
    initial: "O",
    avatarClassName: "bg-success-300 text-success-950",
    status: "in-room",
    detail: "In Project Studio",
  },
  {
    id: "ramnan",
    name: "Ramnan",
    initial: "R",
    avatarClassName: "bg-error-300 text-error-950",
    status: "busy",
    detail: "Busy",
  },
];

export const mockOfflineParticipantCount = 7;
