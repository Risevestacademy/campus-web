import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { browserApi } from "@/core/api/client/browser";
import { SIGN_IN_PATH } from "@/core/navigation";
import { replaceDocument } from "@/shared/lib/document-navigation";

import {
  type FeedbackSendInput,
  sendFeedback,
} from "../services/feedback-api.adapter";
import { COHORT_PEOPLE_KEY } from "./use-cohort-people";

export function useSendFeedback({
  onSent,
}: {
  onSent: (receiptId: string, input: FeedbackSendInput) => void;
}) {
  const inFlight = useRef(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: FeedbackSendInput) => sendFeedback(browserApi, input),
    // A retry after a lost response would send the same feedback twice.
    retry: false,
    onSuccess: (outcome, input) => {
      if (outcome.kind === "sent") {
        onSent(outcome.receipt.id, input);
      } else if (outcome.problem === "signed-out") {
        replaceDocument(SIGN_IN_PATH);
      } else if (outcome.problem === "unknown-person") {
        // The person may have left; read the list again so they are gone.
        void queryClient.invalidateQueries({ queryKey: COHORT_PEOPLE_KEY });
      }
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });

  function send(input: FeedbackSendInput) {
    if (inFlight.current) return;
    inFlight.current = true;
    mutation.reset();
    mutation.mutate(input);
  }

  return {
    send,
    reset: mutation.reset,
    isPending: mutation.isPending,
    problem:
      mutation.data?.kind === "problem" ? mutation.data.problem : undefined,
  };
}
