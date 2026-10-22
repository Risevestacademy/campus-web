import type { ApiClient } from "@/core/api/client";
import { packReportAbout } from "@/shared/lib/report-about";

import { parseFeedbackReceipt } from "../schemas/feedback.schema";
import type { NewFeedback } from "../types";

export type FeedbackSendProblem =
  "invalid" | "signed-out" | "forbidden" | "rate-limited" | "unavailable";

export type FeedbackSend =
  | { kind: "sent"; receipt: { id: string } }
  | { kind: "problem"; problem: FeedbackSendProblem };

export interface FeedbackSendInput {
  feedback: NewFeedback;
  cohortId?: string;
  path?: string;
}

const sendProblems: Record<number, FeedbackSendProblem> = {
  400: "invalid",
  401: "signed-out",
  403: "forbidden",
  429: "rate-limited",
};

function aboutOf(feedback: NewFeedback): string | undefined {
  return feedback.kind === "report"
    ? packReportAbout({
        reported: feedback.reported,
        where: feedback.location,
      })
    : feedback.location || undefined;
}

export async function sendFeedback(
  api: ApiClient,
  { feedback, cohortId, path }: FeedbackSendInput,
): Promise<FeedbackSend> {
  const about = aboutOf(feedback);

  try {
    const { data, response } = await api.POST("/v1/feedback", {
      body: {
        type: feedback.kind,
        title: feedback.title,
        details: feedback.details,
        ...(about ? { about } : {}),
        ...(cohortId ? { cohortId } : {}),
        ...(path ? { context: { path } } : {}),
      },
    });

    if (response.ok) {
      const receipt = parseFeedbackReceipt(data);
      return receipt
        ? { kind: "sent", receipt }
        : { kind: "problem", problem: "unavailable" };
    }

    return {
      kind: "problem",
      problem: sendProblems[response.status] ?? "unavailable",
    };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
