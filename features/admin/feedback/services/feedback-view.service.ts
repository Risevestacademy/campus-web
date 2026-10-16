import type { ApiClient } from "@/core/api/client";

import type {
  FeedbackFilter,
  FeedbackListRead,
  FeedbackQuery,
  FeedbackRecordRead,
  FeedbackStatus,
  FeedbackType,
} from "../types/feedback.types";
import {
  countFeedback,
  listFeedback,
  readFeedback,
} from "./feedback-api.adapter";
import { currentTime } from "./feedback-clock";

export interface FeedbackCounts {
  feedback: number | undefined;
  openReports: number | undefined;
  filters: Partial<Record<FeedbackFilter, number>>;
}

export interface FeedbackView {
  now: number;
  counts: FeedbackCounts;
  list: FeedbackListRead;
  detail: FeedbackRecordRead | undefined;
}

async function totalOf(
  api: ApiClient,
  filters: { type: FeedbackType; status?: FeedbackStatus },
): Promise<number | undefined> {
  const count = await countFeedback(api, filters);
  return count.kind === "loaded" ? count.total : undefined;
}

function sum(...values: (number | undefined)[]): number | undefined {
  return values.every((value) => value !== undefined)
    ? values.reduce<number>((total, value) => total + (value ?? 0), 0)
    : undefined;
}

function difference(
  whole: number | undefined,
  part: number | undefined,
): number | undefined {
  return whole === undefined || part === undefined ? undefined : whole - part;
}

async function readCounts(
  api: ApiClient,
  tab: FeedbackQuery["tab"],
): Promise<FeedbackCounts> {
  const [bugs, ideas, openReports] = await Promise.all([
    totalOf(api, { type: "bug" }),
    totalOf(api, { type: "idea" }),
    totalOf(api, { type: "report", status: "open" }),
  ]);
  const feedback = sum(bugs, ideas);

  if (tab === "reports") {
    const resolvedReports = await totalOf(api, {
      type: "report",
      status: "resolved",
    });
    return {
      feedback,
      openReports,
      filters: { open: openReports, resolved: resolvedReports },
    };
  }

  const [openBugs, openIdeas] = await Promise.all([
    totalOf(api, { type: "bug", status: "open" }),
    totalOf(api, { type: "idea", status: "open" }),
  ]);
  const open = sum(openBugs, openIdeas);

  return {
    feedback,
    openReports,
    filters: {
      all: feedback,
      open,
      resolved: difference(feedback, open),
      bug: bugs,
      idea: ideas,
    },
  };
}

function listTarget(query: FeedbackQuery): {
  types: readonly FeedbackType[];
  status?: FeedbackStatus;
} {
  if (query.tab === "reports") {
    return {
      types: ["report"],
      status: query.filter === "resolved" ? "resolved" : "open",
    };
  }

  switch (query.filter) {
    case "bug":
      return { types: ["bug"] };
    case "idea":
      return { types: ["idea"] };
    case "open":
      return { types: ["bug", "idea"], status: "open" };
    case "resolved":
      return { types: ["bug", "idea"], status: "resolved" };
    default:
      return { types: ["bug", "idea"] };
  }
}

export async function loadFeedbackView(
  api: ApiClient,
  query: FeedbackQuery,
): Promise<FeedbackView> {
  const [counts, list] = await Promise.all([
    readCounts(api, query.tab),
    listFeedback(api, { ...listTarget(query), page: query.page }),
  ]);

  const selectedId =
    query.itemId ??
    (query.tab === "feedback" && list.kind === "loaded"
      ? list.items[0]?.id
      : undefined);
  const detail = selectedId ? await readFeedback(api, selectedId) : undefined;

  return { now: currentTime(), counts, list, detail };
}
