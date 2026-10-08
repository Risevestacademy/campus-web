import type { components } from "@/core/api/client";

type CompatibleSystemRole = components["schemas"]["SystemRole"] | "super_admin";

type GeneratedInvitePreview = components["schemas"]["InvitePreviewResponseDto"];
type GeneratedPendingInvite =
  components["schemas"]["InviteOnboardingResponseDto"];

export type SystemRole = CompatibleSystemRole;
export type InvitePreview = Omit<GeneratedInvitePreview, "systemRole"> & {
  systemRole: CompatibleSystemRole;
};
export type PendingInvite = Omit<GeneratedPendingInvite, "systemRole"> & {
  systemRole: CompatibleSystemRole;
};

export type InviteProblem =
  | "expired"
  | "not-found"
  | "already-accepted"
  | "closed"
  | "already-member"
  | "signed-out"
  | "unavailable";

// Problems a screen explains. "signed-out" becomes a navigation to sign-in.
export type ExplainedInviteProblem = Exclude<InviteProblem, "signed-out">;

export type InviteRead<Invite> =
  | { kind: "loaded"; invite: Invite }
  | { kind: "problem"; problem: InviteProblem };

export type InviteAcceptance =
  | { kind: "accepted"; destination: string }
  | { kind: "problem"; problem: InviteProblem };
