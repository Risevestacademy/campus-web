export type ParticipantStatus = "available" | "in-room" | "busy";
export type ParticipantAction = "wave" | "go-to" | "message";

export type Participant = {
  id: string;
  name: string;
  initial: string;
  avatarClassName: string;
  status: ParticipantStatus;
  detail: string;
};
