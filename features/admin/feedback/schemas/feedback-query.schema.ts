import { z } from "zod";

import { FIRST_PAGE, pageNumberSchema } from "@/shared/lib/search-params";

import type {
  FeedbackFilter,
  FeedbackQuery,
  FeedbackTab,
} from "../types/feedback.types";

const TAB_FILTERS: Readonly<Record<FeedbackTab, readonly FeedbackFilter[]>> = {
  feedback: ["all", "open", "resolved", "bug", "idea"],
  reports: ["open", "resolved"],
};

const DEFAULT_FILTER: Readonly<Record<FeedbackTab, FeedbackFilter>> = {
  feedback: "all",
  reports: "open",
};

const querySchema = z.object({
  tab: z.enum(["feedback", "reports"]).catch("feedback"),
  filter: z.string().optional().catch(undefined),
  page: pageNumberSchema.catch(FIRST_PAGE),
  item: z.string().min(1).max(64).optional().catch(undefined),
});

export function parseFeedbackQuery(raw: {
  tab?: string;
  filter?: string;
  page?: string;
  item?: string;
}): FeedbackQuery {
  const { tab, filter, page, item } = querySchema.parse(raw);
  const known = TAB_FILTERS[tab];
  const chosen = known.find((candidate) => candidate === filter);

  return {
    tab,
    filter: chosen ?? DEFAULT_FILTER[tab],
    page,
    itemId: item,
  };
}

export function filtersFor(tab: FeedbackTab): readonly FeedbackFilter[] {
  return TAB_FILTERS[tab];
}
