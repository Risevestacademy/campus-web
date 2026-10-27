import type { ApiClient } from "@/core/api/client";

import { parseFeedbackReceipt } from "../schemas/feedback.schema";
import type { NewFeedback } from "../types";

export type FeedbackSendProblem =
  | "invalid"
  | "unknown-person"
  | "signed-out"
  | "forbidden"
  | "rate-limited"
  | "unavailable";

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
        ...(feedback.location ? { about: feedback.location } : {}),
        ...(feedback.kind === "report" && feedback.reportedUserId
          ? { reportedUserId: feedback.reportedUserId }
          : {}),
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

    // The fields were checked here, so a 400 on a report that names a person
    // is the server not finding that account.
    const namedPerson =
      feedback.kind === "report" && feedback.reportedUserId !== "";
    return {
      kind: "problem",
      problem:
        response.status === 400 && namedPerson
          ? "unknown-person"
          : (sendProblems[response.status] ?? "unavailable"),
    };
  } catch {
    return { kind: "problem", problem: "unavailable" };
  }
}
