import type { ApiClient } from "@/core/api/client";

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

// campus-api has one free-text field, so a report carries who and where in it,
// split on the first "|". The admin Feedback page reads it back the same way.
function packAbout(feedback: NewFeedback): string | undefined {
  if (feedback.kind === "report") {
    return `${feedback.reported.replaceAll("|", "/")} | ${feedback.location}`.trim();
  }

  return feedback.location || undefined;
}

export async function sendFeedback(
  api: ApiClient,
  { feedback, cohortId, path }: FeedbackSendInput,
): Promise<FeedbackSend> {
  try {
    const { data, response } = await api.POST("/v1/feedback", {
      body: {
        type: feedback.kind,
        title: feedback.title,
        details: feedback.details,
        ...(packAbout(feedback) ? { about: packAbout(feedback) } : {}),
        ...(cohortId ? { cohortId } : {}),
        ...(path ? { context: { path } } : {}),
      },
    });

    if (response.ok && data) {
      return { kind: "sent", receipt: { id: data.id } };
    }

    return {
      kind: "problem",
      problem: sendProblems[response.status] ?? "unavailable",
    };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
