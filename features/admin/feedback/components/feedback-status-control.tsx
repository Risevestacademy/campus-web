"use client";

import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr/ArrowCounterClockwise";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";

import { Button } from "@/shared/ui/button";

import { useSetFeedbackStatus } from "../hooks/use-set-feedback-status";
import type {
  FeedbackStatus,
  FeedbackStatusProblem,
} from "../types/feedback.types";

const PROBLEM_MESSAGES: Record<FeedbackStatusProblem, string | undefined> = {
  invalid: "campus-api rejected this change. Refresh the page and try again.",
  "signed-out": undefined,
  forbidden: "You no longer have permission to update feedback.",
  missing: "This feedback no longer exists. Refresh the page.",
  unavailable:
    "We couldn't update this feedback. Nothing was changed. Check your connection and try again.",
};

export function FeedbackStatusControl({
  feedbackId,
  title,
  status,
}: {
  feedbackId: string;
  title: string;
  status: FeedbackStatus;
}) {
  const { setStatus, isPending, problem } = useSetFeedbackStatus({
    feedbackId,
    title,
  });
  const isOpen = status === "open";
  const message = problem ? PROBLEM_MESSAGES[problem] : undefined;

  return (
    <div className="grid justify-items-end gap-2">
      <Button
        type="button"
        variant={isOpen ? "default" : "outline"}
        size="sm"
        disabled={isPending}
        onClick={() => setStatus(isOpen ? "resolved" : "open")}
        className="dark:border-[#2B3B5F]"
      >
        {isOpen ? (
          <CheckCircleIcon aria-hidden />
        ) : (
          <ArrowCounterClockwiseIcon aria-hidden />
        )}
        {isOpen ? "Mark as resolved" : "Reopen"}
      </Button>
      {message ? (
        <p
          role="alert"
          className="text-destructive max-w-64 text-right text-sm"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
