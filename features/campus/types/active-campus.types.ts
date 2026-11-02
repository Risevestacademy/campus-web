import type { Hearing } from "@/core/presence";

export const PARTICIPANT_TONES = ["cobalt", "lemon", "turquoise"] as const;

export type ParticipantTone = (typeof PARTICIPANT_TONES)[number];

export type MeetingParticipant = Readonly<{
  id: string;
  initials: string;
  name: string;
  tone: ParticipantTone;
}>;

export type Meeting = Readonly<{
  encounter: number;
  hearing: Hearing;
  title: string;
  localParticipantId: MeetingParticipant["id"];
  participants: readonly MeetingParticipant[];
}>;

// A person's camera tile carries their id; their share sits beside it under an
// id of its own, so the two can be focused apart.
export type MeetingTile = Readonly<{
  id: string;
  kind: "person" | "screen" | "own-screen";
  participant: MeetingParticipant;
}>;

export type MeetingTileLayout =
  | Readonly<{ mode: "compact" }>
  | Readonly<{
      mode: "expanded";
      focusedTileId: MeetingTile["id"] | null;
    }>;

// The layout as the view state holds it: a grid remembers the encounter it
// was opened for, so a later encounter starts on the map.
export type OpenedMeetingLayout =
  | Extract<MeetingTileLayout, { mode: "compact" }>
  | (Extract<MeetingTileLayout, { mode: "expanded" }> &
      Readonly<{ encounter: number }>);

export type PresenceStatus = "active" | "busy" | "away";

export type ActiveCampusViewModel = Readonly<{
  viewer: Readonly<{
    initials: string;
    presenceStatus: PresenceStatus;
  }>;
}>;
