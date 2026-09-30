export type ParticipantStatus = "available" | "in-room" | "busy";

export type Participant = {
  id: string;
  name: string;
  initial: string;
  avatarClassName: string;
  status: ParticipantStatus;
  /** The line shown under the name, e.g. "Available · Main hallway". */
  detail: string;
};
