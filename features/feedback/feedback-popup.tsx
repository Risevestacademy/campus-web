"use client";

import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import { type RefObject, useState } from "react";

import { Button } from "@/shared/ui/button";

import { FeedbackForm } from "./feedback-form";
import { FeedbackSent } from "./feedback-sent";
import { useSendFeedback } from "./hooks/use-send-feedback";
import type { FeedbackSendProblem } from "./services/feedback-api.adapter";
import type { NewFeedback, SentFeedback } from "./types";

export interface FeedbackPopupProps {
  isOpen: boolean;
  onClose: () => void;
  container?: RefObject<HTMLElement | null>;
  cohortId?: string;
  userId?: string;
  userName?: string | null;
}

const SEND_PROBLEM_MESSAGES: Record<FeedbackSendProblem, string | undefined> = {
  invalid: "We couldn't send that. Check the fields and try again.",
  "unknown-person":
    "We couldn't find that person. Pick who you are reporting again.",
  "signed-out": undefined,
  forbidden: "You don't have permission to send feedback right now.",
  "rate-limited":
    "You've sent a lot of feedback in the last hour. Please try again later.",
  unavailable:
    "We couldn't send your feedback. Check your connection and try again.",
};

function firstNameOf(userName: string | null | undefined): string | undefined {
  return userName?.trim().split(/\s+/)[0] || undefined;
}

export function FeedbackPopup({
  isOpen,
  onClose,
  container,
  cohortId,
  userId,
  userName,
}: FeedbackPopupProps) {
  const [sent, setSent] = useState<SentFeedback>();
  const [formKey, setFormKey] = useState(0);

  const sending = useSendFeedback({
    onSent: ({ feedback }) =>
      setSent({ kind: feedback.kind, title: feedback.title }),
  });

  function showNewForm() {
    sending.reset();
    setSent(undefined);
    setFormKey((key) => key + 1);
  }

  function send(feedback: NewFeedback) {
    sending.send({
      feedback,
      cohortId,
      path: window.location.pathname,
    });
  }

  return (
    <Dialog.Root
      open={isOpen}
      modal="trap-focus"
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onOpenChangeComplete={(open) => {
        if (!open) showNewForm();
      }}
    >
      <Dialog.Portal container={container}>
        <Dialog.Backdrop
          onClick={onClose}
          className="absolute inset-0 z-40 rounded-xl bg-neutral-950/40 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0"
        />
        <Dialog.Popup className="bg-background text-foreground absolute inset-2 z-50 flex flex-col overflow-hidden rounded-3xl border border-[#D6E3EC] shadow-2xl transition-[opacity,scale] duration-200 outline-none data-ending-style:scale-98 data-ending-style:opacity-0 data-starting-style:scale-98 data-starting-style:opacity-0 motion-reduce:transition-opacity md:inset-x-6 md:top-6 md:bottom-20 md:mx-auto md:max-w-3xl dark:border-[#2B3B5F] dark:bg-[#1F2940]">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#D6E3EC] px-6 py-5 dark:border-[#2B3B5F]">
            <div className="grid gap-1">
              <Dialog.Title className="font-display text-3xl font-semibold">
                Feedback
              </Dialog.Title>
              <Dialog.Description className="text-foreground-secondary">
                Help shape Campus. We read every note.
              </Dialog.Description>
            </div>
            <Dialog.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hover:bg-error-500 hover:text-error-50 dark:hover:bg-error-500 dark:hover:text-error-50 size-9 rounded-full bg-[#E6F2F7] dark:bg-[#2B3B5F]"
                />
              }
            >
              <XIcon aria-hidden />
              <span className="sr-only">Close feedback</span>
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <div className="mx-auto w-full max-w-2xl">
              {sent ? (
                <FeedbackSent
                  firstName={firstNameOf(userName)}
                  sent={sent}
                  onSendAnother={showNewForm}
                  onBack={onClose}
                />
              ) : (
                <FeedbackForm
                  key={formKey}
                  cohortId={cohortId}
                  userId={userId}
                  isSending={sending.isPending}
                  sendError={
                    sending.problem
                      ? SEND_PROBLEM_MESSAGES[sending.problem]
                      : undefined
                  }
                  onCancel={onClose}
                  onSubmit={send}
                />
              )}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
