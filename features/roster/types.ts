import type { ComponentType, ReactNode } from "react";

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
  isSelf: boolean;
};

export type CohortContext = {
  name: string;
  role?: components["schemas"]["CohortRole"];
};

// Another member's profile card, drawn inside the row's popover. Routes pass
// it in, because the roster may not import the profile feature.
export type ProfileCardComponent = ComponentType<{
  userId: string;
  cohortId: string;
  name: string;
  initial: string;
  avatarClassName: string;
  presence: { badgeClassName: string; label: string };
  actions?: ReactNode;
}>;
