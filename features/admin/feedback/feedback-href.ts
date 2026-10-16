import type { Route } from "next";

import type { FeedbackFilter, FeedbackTab } from "./types/feedback.types";

const DEFAULT_FILTER: Readonly<Record<FeedbackTab, FeedbackFilter>> = {
  feedback: "all",
  reports: "open",
};

export function feedbackAdministrationHref(
  cohortId: string,
  view: {
    tab: FeedbackTab;
    filter?: FeedbackFilter;
    page?: number;
    itemId?: string;
  },
): Route {
  const search = new URLSearchParams();

  if (view.tab !== "feedback") search.set("tab", view.tab);
  if (view.filter && view.filter !== DEFAULT_FILTER[view.tab]) {
    search.set("filter", view.filter);
  }
  if (view.page && view.page > 1) search.set("page", String(view.page));
  if (view.itemId) search.set("item", view.itemId);

  const query = search.toString();
  const path = `/campus/${encodeURIComponent(cohortId)}/feedback`;

  return (query ? `${path}?${query}` : path) as Route;
}
