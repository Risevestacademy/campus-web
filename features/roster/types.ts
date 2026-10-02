export type ParticipantStatus = "available" | "in-room" | "busy";

export type Participant = {
  id: string;
  name: string;
  initial: string;
  avatarClassName: string;
  status: ParticipantStatus;
  detail: string;
};
