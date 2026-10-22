import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";

import { browserApi } from "@/core/api/client/browser";
import { replaceDocument } from "@/shared/lib/document-navigation";

import {
  type FeedbackSendInput,
  sendFeedback,
} from "../services/feedback-api.adapter";

const SIGN_IN_PATH = "/sign-in";

export function useSendFeedback({
  onSent,
}: {
  onSent: (receiptId: string, input: FeedbackSendInput) => void;
}) {
  const inFlight = useRef(false);

  const mutation = useMutation({
    mutationFn: (input: FeedbackSendInput) => sendFeedback(browserApi, input),
    // A retry after a lost response would send the same feedback twice.
    retry: false,
    onSuccess: (outcome, input) => {
      if (outcome.kind === "sent") {
        onSent(outcome.receipt.id, input);
      } else if (outcome.problem === "signed-out") {
        replaceDocument(SIGN_IN_PATH);
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
