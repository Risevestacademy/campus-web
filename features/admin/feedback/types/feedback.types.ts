import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";

type Schemas = components["schemas"];

export type FeedbackType = Schemas["FeedbackType"];
export type FeedbackStatus = Schemas["FeedbackStatus"];
export type FeedbackPerson = Simplify<
  Pick<Schemas["FeedbackPersonDto"], "id" | "email" | "displayName">
>;
// The page reads where a member said they were, nothing else of the context.
export type FeedbackContext = Simplify<
  Pick<Schemas["FeedbackContextDto"], "path">
>;
export type FeedbackSummary = Simplify<
  Pick<
    Schemas["FeedbackListItemDto"],
    "id" | "type" | "title" | "about" | "status" | "createdAt"
  > & {
    submittedBy: FeedbackPerson;
    reportedUser: FeedbackPerson | null;
  }
>;
export type FeedbackRecord = Simplify<
  Pick<
    Schemas["FeedbackDto"],
    | "id"
    | "type"
    | "title"
    | "about"
    | "status"
    | "createdAt"
    | "details"
    | "resolvedAt"
  > & {
    submittedBy: FeedbackPerson;
    reportedUser: FeedbackPerson | null;
    context: FeedbackContext | null;
    resolvedBy: FeedbackPerson | null;
  }
>;

export interface FeedbackPage {
  items: FeedbackSummary[];
  page: number;
  totalPages: number;
  total: number;
  truncated: boolean;
}

export type FeedbackListRead =
  ({ kind: "loaded" } & FeedbackPage) | { kind: "unavailable" };
export type FeedbackRecordRead =
  | { kind: "loaded"; feedback: FeedbackRecord }
  | { kind: "missing" }
  | { kind: "unavailable" };
export type FeedbackCountRead =
  { kind: "loaded"; total: number } | { kind: "unavailable" };

export type FeedbackStatusProblem =
  "invalid" | "signed-out" | "forbidden" | "missing" | "unavailable";
export type FeedbackStatusChange =
  { kind: "updated" } | { kind: "problem"; problem: FeedbackStatusProblem };

export type FeedbackTab = "feedback" | "reports";
export type FeedbackFilter = "all" | "open" | "resolved" | "bug" | "idea";

export interface FeedbackQuery {
  tab: FeedbackTab;
  filter: FeedbackFilter;
  page: number;
  itemId: string | undefined;
}
