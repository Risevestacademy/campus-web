import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";

type Schemas = components["schemas"];

export type InviteStatus = Schemas["InviteStatus"];
// The tabs the page shows. A declined invite has no tab.
export type InviteTab = Extract<
  InviteStatus,
  "pending" | "accepted" | "expired" | "revoked"
>;

export interface InvitesQuery {
  tab: InviteTab;
  page: number;
}

// What `GET /v1/invites` sends that the Invites page reads. The sender is an
// account id there, not a name, so it is not read.
export type Invite = Simplify<
  Pick<
    Schemas["AdminInviteListItemDto"],
    | "id"
    | "email"
    | "status"
    | "cohortRole"
    | "expiresAt"
    | "revokedAt"
    | "createdAt"
  >
>;

export type InvitesBody = Simplify<{
  items: Invite[];
  meta: Pick<
    Schemas["PaginatedAdminInviteListItemDto"]["meta"],
    "page" | "totalPages" | "total"
  >;
}>;

export interface InvitesPage {
  invites: Invite[];
  page: number;
  totalPages: number;
  total: number;
}

export type InvitesListRead =
  ({ kind: "loaded" } & InvitesPage) | { kind: "unavailable" };

export type InviteCountRead =
  { kind: "loaded"; total: number } | { kind: "unavailable" };

export type InviteRecordProblem =
  "invalid" | "signed-out" | "forbidden" | "missing" | "unavailable";
export type InviteResendProblem = InviteRecordProblem | "settled" | "conflict";
export type InviteRevokeProblem = InviteRecordProblem | "settled" | "expired";

export type InviteResend =
  | { kind: "resent"; emailed: boolean }
  | { kind: "problem"; problem: InviteResendProblem };
export type InviteRevoke =
  { kind: "revoked" } | { kind: "problem"; problem: InviteRevokeProblem };
