import type { components } from "@/core/api/client";
import type { Simplify } from "@/core/api/schemas";

type Schemas = components["schemas"];

export type FeedbackType = Schemas["FeedbackType"];
export type FeedbackStatus = Schemas["FeedbackStatus"];
export type FeedbackPerson = Simplify<Schemas["FeedbackPersonDto"]>;
export type FeedbackContext = Simplify<Schemas["FeedbackContextDto"]>;
export type FeedbackSummary = Simplify<Schemas["FeedbackListItemDto"]>;
export type FeedbackRecord = Simplify<Schemas["FeedbackDto"]>;

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
