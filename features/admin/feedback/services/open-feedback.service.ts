import type { ApiClient } from "@/core/api/client";

import type { FeedbackSummary } from "../types/feedback.types";
import { type LatestOpenRead, readLatestOpen } from "./feedback-api.adapter";
import { sum } from "./feedback-totals";

export interface OpenFeedback {
  now: number;
  reports: LatestOpenRead;
  bugs: LatestOpenRead;
  ideas: LatestOpenRead;
}

export async function loadOpenFeedback(api: ApiClient): Promise<OpenFeedback> {
  const [reports, bugs, ideas] = await Promise.all([
    readLatestOpen(api, "report"),
    readLatestOpen(api, "bug"),
    readLatestOpen(api, "idea"),
  ]);

  return { now: Date.now(), reports, bugs, ideas };
}

function openTotalOf(read: LatestOpenRead): number | undefined {
  return read.kind === "loaded" ? read.total : undefined;
}

export function openCounts(open: OpenFeedback): {
  reports: number | undefined;
  feedback: number | undefined;
  all: number | undefined;
} {
  const reports = openTotalOf(open.reports);
  const bugs = openTotalOf(open.bugs);
  const ideas = openTotalOf(open.ideas);
  const feedback = sum(bugs, ideas);

  return { reports, feedback, all: sum(reports, feedback) };
}

// The most recent open item of each kind, a report first, then a bug, then an
// idea. A kind with nothing open is left out.
export function attentionItems(open: OpenFeedback): FeedbackSummary[] {
  return [open.reports, open.bugs, open.ideas].flatMap((read) =>
    read.kind === "loaded" && read.latest ? [read.latest] : [],
  );
}

export function isMissingData(open: OpenFeedback): boolean {
  return [open.reports, open.bugs, open.ideas].some(
    (read) => read.kind === "unavailable",
  );
}
