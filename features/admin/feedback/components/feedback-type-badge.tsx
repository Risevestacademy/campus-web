import type { Icon } from "@phosphor-icons/react";
import { BugIcon } from "@phosphor-icons/react/dist/ssr/Bug";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/ssr/ChatCircle";
import { LightbulbIcon } from "@phosphor-icons/react/dist/ssr/Lightbulb";
import { cn } from "cn";

import type { FeedbackType } from "../types/feedback.types";

const TYPE_DETAILS: Readonly<
  Record<FeedbackType, { Icon: Icon; label: string; className: string }>
> = {
  bug: {
    Icon: BugIcon,
    label: "Bug",
    className:
      "bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-300",
  },
  idea: {
    Icon: LightbulbIcon,
    label: "Idea",
    className:
      "bg-[#E9E4FB] text-[#6D3FD6] dark:bg-[#3A3366] dark:text-[#B9A8F5]",
  },
  report: {
    Icon: ChatCircleIcon,
    label: "Report",
    className:
      "bg-lemon-100 text-lemon-800 dark:bg-lemon-900/40 dark:text-lemon-300",
  },
};

export function feedbackTypeDetails(type: FeedbackType) {
  return TYPE_DETAILS[type];
}

export function feedbackTypeLabel(type: FeedbackType): string {
  return TYPE_DETAILS[type].label;
}

export function FeedbackTypeBadge({ type }: { type: FeedbackType }) {
  const { Icon, label, className } = TYPE_DETAILS[type];

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-sm",
        className,
      )}
    >
      <Icon aria-hidden size={14} />
      {label}
    </span>
  );
}
