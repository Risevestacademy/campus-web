import { cn } from "cn";

import type { FeedbackStatus } from "../types/feedback.types";

const STATUS_DETAILS: Readonly<
  Record<FeedbackStatus, { label: string; className: string }>
> = {
  open: {
    label: "Open",
    className:
      "bg-cobalt-100 text-cobalt-700 dark:bg-[#2B3B5F] dark:text-cobalt-200",
  },
  resolved: {
    label: "Resolved",
    className:
      "bg-success-100 text-success-800 dark:bg-success-900/50 dark:text-success-300",
  },
};

export function FeedbackStatusLabel({ status }: { status: FeedbackStatus }) {
  const { label, className } = STATUS_DETAILS[status];

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-sm",
        className,
      )}
    >
      {label}
    </span>
  );
}
