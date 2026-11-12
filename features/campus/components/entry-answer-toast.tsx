import { cn } from "cn";

import { avatarToneOf, initialOf } from "@/shared/lib/avatar";
import { toast } from "@/shared/ui/toast";

import type { EntryAnswerToast } from "../services/presence-session/answer-entry-requests";

export function showEntryAnswerToast({
  askerId,
  askerName,
  id,
  onAnswer,
  onClose,
}: EntryAnswerToast) {
  toast.add({
    id,
    title: askerName,
    description: "is asking to enter",
    priority: "high",
    timeout: 0,
    onClose,
    data: {
      tile: {
        actions: [
          {
            label: "Not now",
            onClick: () => onAnswer(false),
            variant: "outline",
          },
          { label: "Let in", onClick: () => onAnswer(true) },
        ],
        icon: (
          <span
            aria-hidden
            className={cn(
              "grid size-10 place-items-center rounded-full text-base font-semibold",
              avatarToneOf(askerId),
            )}
          >
            {initialOf(askerName)}
          </span>
        ),
        tone: "plain",
      },
    },
  });
}
