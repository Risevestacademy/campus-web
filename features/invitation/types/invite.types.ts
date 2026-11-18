import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";

type Schemas = components["schemas"];
type Named<Dto extends { name: string }> = Pick<Dto, "name">;

export type SystemRole = Schemas["SystemRole"];

// Only the fields the screens render: the invitee's email and every id stay
// out of the preview.
export type InvitePreview = Simplify<
  Pick<Schemas["InvitePreviewResponseDto"], "cohortRole" | "systemRole"> & {
    cohort: Named<Schemas["InvitePreviewCohortDto"]> | null;
    track: Named<Schemas["InvitePreviewTrackDto"]> | null;
    invitedBy: Schemas["InvitePreviewInviterDto"];
  }
>;

export type PendingInvite = Simplify<
  Pick<
    Schemas["InviteOnboardingResponseDto"],
    "id" | "cohortRole" | "systemRole"
  > & {
    cohort: Named<Schemas["InviteCohortDto"]> | null;
    track: Named<Schemas["InviteTrackDto"]> | null;
    user: Pick<
      Schemas["InviteInviteeDto"],
      "email" | "displayName" | "firstName" | "lastName"
    >;
  }
>;

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
