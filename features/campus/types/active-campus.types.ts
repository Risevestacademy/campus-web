export type MeetingParticipant = Readonly<{
  id: string;
  initials: string;
  name: string;
}>;

export type PresenceStatus = "active" | "busy" | "away";

export type ActiveCampusViewModel = Readonly<{
  meeting: Readonly<{
    localParticipantId: MeetingParticipant["id"];
    participants: readonly MeetingParticipant[];
    remainingParticipantCount: number;
    title: string;
  }>;
  viewer: Readonly<{
    initials: string;
    presenceStatus: PresenceStatus;
  }>;
}>;
