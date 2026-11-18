import type { ApiClient } from "@/core/api/client";

import {
  parseFeedbackList,
  parseFeedbackRecord,
} from "../schemas/feedback.schema";
import type {
  FeedbackCountRead,
  FeedbackListRead,
  FeedbackPage,
  FeedbackRecordRead,
  FeedbackStatus,
  FeedbackStatusChange,
  FeedbackStatusProblem,
  FeedbackSummary,
  FeedbackType,
} from "../types/feedback.types";

export const FEEDBACK_PAGE_SIZE = 20;
// The backend caps a page at 100. A queue that spans two types is merged
// here, so it can only reach this far into each.
const MERGE_WINDOW = 100;

interface FeedbackFilters {
  type?: FeedbackType;
  status?: FeedbackStatus;
}

async function readPage(
  api: ApiClient,
  filters: FeedbackFilters,
  page: number,
  perPage: number,
): Promise<Omit<FeedbackPage, "truncated"> | undefined> {
  try {
    const { data, response } = await api.GET("/v1/feedback", {
      params: { query: { ...filters, page, perPage } },
    });
    return response.ok ? parseFeedbackList(data) : undefined;
  } catch {
    return undefined;
  }
}

function newestFirst(a: FeedbackSummary, b: FeedbackSummary): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

export async function listFeedback(
  api: ApiClient,
  query: {
    types: readonly FeedbackType[];
    status?: FeedbackStatus;
    page: number;
  },
): Promise<FeedbackListRead> {
  const [onlyType, ...otherTypes] = query.types;

  if (onlyType !== undefined && otherTypes.length === 0) {
    const page = await readPage(
      api,
      { type: onlyType, status: query.status },
      query.page,
      FEEDBACK_PAGE_SIZE,
    );
    return page
      ? { kind: "loaded", ...page, truncated: false }
      : { kind: "unavailable" };
  }

  const windows = await Promise.all(
    query.types.map((type) =>
      readPage(api, { type, status: query.status }, 1, MERGE_WINDOW),
    ),
  );
  if (windows.some((window) => window === undefined)) {
    return { kind: "unavailable" };
  }

  const loaded = windows.filter((window) => window !== undefined);
  const merged = loaded.flatMap((window) => window.items).sort(newestFirst);
  const total = loaded.reduce((sum, window) => sum + window.total, 0);
  const start = (query.page - 1) * FEEDBACK_PAGE_SIZE;

  return {
    kind: "loaded",
    items: merged.slice(start, start + FEEDBACK_PAGE_SIZE),
    page: query.page,
    totalPages: Math.ceil(merged.length / FEEDBACK_PAGE_SIZE),
    total,
    truncated: loaded.some((window) => window.total > MERGE_WINDOW),
  };
}

export type LatestOpenRead =
  | { kind: "loaded"; total: number; latest: FeedbackSummary | undefined }
  | { kind: "unavailable" };

// The list is newest first, so a page of one carries the latest item and the
// total together.
export async function readLatestOpen(
  api: ApiClient,
  type: FeedbackType,
): Promise<LatestOpenRead> {
  const page = await readPage(api, { type, status: "open" }, 1, 1);
  return page
    ? { kind: "loaded", total: page.total, latest: page.items[0] }
    : { kind: "unavailable" };
}

export async function countFeedback(
  api: ApiClient,
  filters: FeedbackFilters,
): Promise<FeedbackCountRead> {
  const page = await readPage(api, filters, 1, 1);
  return page ? { kind: "loaded", total: page.total } : { kind: "unavailable" };
}

export async function readFeedback(
  api: ApiClient,
  id: string,
): Promise<FeedbackRecordRead> {
  try {
    const { data, response } = await api.GET("/v1/feedback/{id}", {
      params: { path: { id } },
    });
    if (response.status === 404 || response.status === 400) {
      return { kind: "missing" };
    }

    const feedback = response.ok ? parseFeedbackRecord(data) : undefined;
    return feedback ? { kind: "loaded", feedback } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

const statusProblems: Record<number, FeedbackStatusProblem> = {
  400: "invalid",
  401: "signed-out",
  403: "forbidden",
  404: "missing",
};

export async function setFeedbackStatus(
  api: ApiClient,
  id: string,
  status: FeedbackStatus,
): Promise<FeedbackStatusChange> {
  try {
    const { response } = await api.PATCH("/v1/feedback/{id}", {
      params: { path: { id } },
      body: { status },
    });
    return response.ok
      ? { kind: "updated" }
      : {
          kind: "problem",
          problem: statusProblems[response.status] ?? "unavailable",
        };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
