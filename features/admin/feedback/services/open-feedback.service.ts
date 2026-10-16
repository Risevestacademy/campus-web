import type { ApiClient } from "@/core/api/client";

import type { FeedbackSummary } from "../types/feedback.types";
import { type LatestOpenRead, readLatestOpen } from "./feedback-api.adapter";
import { currentTime } from "./feedback-clock";

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

  return { now: currentTime(), reports, bugs, ideas };
}

function totalOf(read: LatestOpenRead): number | undefined {
  return read.kind === "loaded" ? read.total : undefined;
}

export function openCounts(open: OpenFeedback): {
  reports: number | undefined;
  feedback: number | undefined;
  all: number | undefined;
} {
  const reports = totalOf(open.reports);
  const bugs = totalOf(open.bugs);
  const ideas = totalOf(open.ideas);
  const feedback =
    bugs === undefined || ideas === undefined ? undefined : bugs + ideas;

  return {
    reports,
    feedback,
    all:
      reports === undefined || feedback === undefined
        ? undefined
        : reports + feedback,
  };
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
