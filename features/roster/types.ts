import type { components } from "@/core/api/client";

export type ParticipantStatus = "available" | "busy" | "away";
export type ParticipantAction = "wave" | "go-to" | "message";

export type Participant = {
  id: string;
  name: string;
  initial: string;
  avatarClassName: string;
  // Offline people have no presence, so they carry no status of their own.
  status: ParticipantStatus | "offline";
  detail: string;
};

export type CohortContext = {
  name: string;
  role?: components["schemas"]["CohortRole"];
};
