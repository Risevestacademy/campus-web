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

// The roles Invite people offers. A guest has no entry: it needs an access end
// date, and its own popup. Super admin cannot be invited.
export type InviteRole =
  Extract<Schemas["CohortRole"], "student" | "professor" | "mentor"> | "admin";

// What `POST /v1/invites` takes that Invite people sends.
export type InviteRequest = Simplify<
  Pick<Schemas["CreateInviteDto"], "email"> &
    Partial<
      Pick<
        Schemas["CreateInviteDto"],
        | "cohortId"
        | "cohortRole"
        | "cohortTrackId"
        | "mentorshipGroupId"
        | "systemRole"
      >
    >
>;

export type InviteCreateProblem =
  InviteRecordProblem | "conflict" | "rate-limited";

export type InviteCreate =
  | { kind: "created"; emailed: boolean }
  | { kind: "problem"; problem: InviteCreateProblem };

export interface InviteFailure {
  email: string;
  problem: InviteCreateProblem;
}

export type InvitesSent =
  | { kind: "signed-out" }
  | {
      kind: "done";
      sent: number;
      notEmailed: number;
      failures: InviteFailure[];
    };

// A track offered to an invite: the id is the cohort's attachment of the
// track, which is what an invite names.
export interface InviteTrackOption {
  id: string;
  name: string;
  // What a CSV row names a track by.
  code: string;
}

export interface InviteGroupOption {
  id: string;
  name: string;
  mentorName: string | undefined;
}

export type InviteOptionsRead<TOption> =
  { kind: "loaded"; options: TOption[] } | { kind: "unavailable" };

export interface InviteOptions {
  tracks: InviteOptionsRead<InviteTrackOption>;
  groups: InviteOptionsRead<InviteGroupOption>;
}

// What `GET /v1/cohorts/{id}/mentorship-groups` sends that the popup reads.
export type GroupsBody = Simplify<{
  items: Simplify<
    Pick<Schemas["MentorshipGroupResponseDto"], "id" | "name"> & {
      mentor: {
        user: Pick<Schemas["RosterUserDto"], "displayName" | "firstName">;
      };
    }
  >[];
  meta: Pick<Schemas["PaginationMetaDto"], "page" | "totalPages">;
}>;

// What `POST /v1/invites/import` sends that the popup reads. The link in each
// row is a secret shown once, and nothing here shows it.
export type ImportBody = Simplify<
  Pick<Schemas["InviteImportResponseDto"], "invited"> & {
    rows: Simplify<
      Pick<
        Schemas["InviteImportRowDto"],
        "line" | "email" | "outcome" | "emailStatus" | "reason"
      >
    >[];
  }
>;

export interface ImportedRow {
  line: number;
  email: string;
  reason: string;
}

export interface InviteImport {
  invited: number;
  notEmailed: number;
  // The rows that were not invited, with why.
  failed: ImportedRow[];
}

export type InviteImportProblem =
  InviteRecordProblem | "unreadable" | "rate-limited";

export type InviteImportRead =
  | ({ kind: "imported" } & InviteImport)
  | { kind: "problem"; problem: InviteImportProblem };
