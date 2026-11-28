import type { AudioMode, SpaceAccess, SpaceKind } from "../types/maps.types";

export const KIND_LABELS: Readonly<Record<SpaceKind, string>> = {
  open: "Open",
  classroom: "Classroom",
  meeting_room: "Meeting room",
  mentor_pod: "Mentor pod",
  live_coding: "Live coding",
  desk: "Desk area",
  town_hall: "Town hall",
  notice_board: "Notice board",
  stage: "Stage",
  help_desk: "Help desk",
};

export const SPACE_KINDS = Object.keys(KIND_LABELS) as SpaceKind[];

export const ACCESS_LABELS: Readonly<Record<SpaceAccess, string>> = {
  normal: "Anyone in the campus",
  designated: "Only people on its list",
};

export const AUDIO_LABELS: Readonly<
  Record<AudioMode, { label: string; description: string }>
> = {
  proximity: {
    label: "Proximity audio",
    description: "You hear people near you, and voices fade with distance.",
  },
  boundary: {
    label: "Boundary audio",
    description: "Everyone inside the space hears everyone else.",
  },
};

export const AUDIO_MODES = Object.keys(AUDIO_LABELS) as AudioMode[];

// What a space is for, which the map colours it by. Ten kinds read as five
// colours at a glance.
export type KindGroup = "gather" | "learn" | "talk" | "work" | "help";

export const KIND_GROUPS: Readonly<Record<SpaceKind, KindGroup>> = {
  town_hall: "gather",
  stage: "gather",
  classroom: "learn",
  live_coding: "learn",
  meeting_room: "talk",
  mentor_pod: "talk",
  open: "work",
  desk: "work",
  help_desk: "help",
  notice_board: "help",
};

export const KIND_GROUP_ORDER: readonly KindGroup[] = [
  "gather",
  "learn",
  "talk",
  "work",
  "help",
];
