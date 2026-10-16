import { browserApi } from "@/core/api/client/browser";
import { toast } from "@/shared/ui/toast";

import { useAdminMutation } from "../../use-admin-mutation";
import { setFeedbackStatus } from "../services/feedback-api.adapter";
import type {
  FeedbackStatus,
  FeedbackStatusProblem,
} from "../types/feedback.types";

const SUCCESS_TITLES: Readonly<Record<FeedbackStatus, string>> = {
  resolved: "Marked as resolved",
  open: "Reopened",
};

export function useSetFeedbackStatus({
  feedbackId,
  title,
}: {
  feedbackId: string;
  title: string;
}) {
  const { mutate, ...controls } = useAdminMutation<
    FeedbackStatus,
    FeedbackStatusProblem
  >({
    mutationFn: (status) => setFeedbackStatus(browserApi, feedbackId, status),
    onSucceeded: (status) => {
      toast.add({
        title: SUCCESS_TITLES[status],
        description: title,
        type: "success",
      });
    },
  });

  return { setStatus: mutate, ...controls };
}
