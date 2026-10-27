import type { Icon } from "@phosphor-icons/react";
import { ClockIcon } from "@phosphor-icons/react/dist/ssr/Clock";
import { MapTrifoldIcon } from "@phosphor-icons/react/dist/ssr/MapTrifold";
import { cn } from "cn";
import type { ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/shared/ui/avatar";

import {
  avatarTone,
  describeAge,
  personInitial,
  personName,
  reportedNameOf,
} from "../feedback-format";
import type { FeedbackRecord } from "../types/feedback.types";
import { FeedbackStatusControl } from "./feedback-status-control";
import { FeedbackStatusLabel } from "./feedback-status-label";
import { FeedbackTypeBadge } from "./feedback-type-badge";
import { LocalDateTime } from "./local-date-time";

function describeWhere(feedback: FeedbackRecord): string {
  return feedback.about ?? feedback.context?.path ?? "Not given";
}

function Fact({
  Icon,
  label,
  children,
}: {
  Icon: Icon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid content-start gap-1 rounded-xl bg-[#EFFAFF] p-4 dark:bg-[#2B3B5F]">
      <dt className="text-foreground-secondary flex items-center gap-2 text-sm">
        <Icon aria-hidden size={16} />
        {label}
      </dt>
      <dd className="text-sm font-medium [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
  );
}

export function FeedbackDetail({
  feedback,
  now,
  className,
}: {
  feedback: FeedbackRecord;
  now: number;
  className?: string;
}) {
  const { submittedBy, resolvedBy } = feedback;
  const reportedName =
    feedback.type === "report" ? reportedNameOf(feedback) : undefined;

  return (
    <article
      aria-labelledby="feedback-detail-heading"
      className={cn(
        "border-border grid content-start gap-6 rounded-3xl border p-6 dark:border-[#2B3B5F]",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {feedback.type === "report" ? null : (
            <FeedbackTypeBadge type={feedback.type} />
          )}
          <FeedbackStatusLabel status={feedback.status} />
        </div>
        <FeedbackStatusControl
          key={feedback.id + feedback.status}
          feedbackId={feedback.id}
          title={feedback.title}
          status={feedback.status}
        />
      </div>

      <h2
        id="feedback-detail-heading"
        className="font-display text-3xl font-semibold [overflow-wrap:anywhere]"
      >
        {feedback.title}
      </h2>

      <div className="flex items-center gap-3">
        <Avatar size="lg">
          <AvatarFallback className={avatarTone(submittedBy.id)}>
            {personInitial(submittedBy)}
          </AvatarFallback>
        </Avatar>
        <div className="grid min-w-0">
          <p className="truncate font-medium">{personName(submittedBy)}</p>
          <p className="text-foreground-secondary truncate text-sm">
            {submittedBy.email} · {describeAge(feedback.createdAt, now)}
          </p>
        </div>
      </div>

      {reportedName ? (
        <p className="text-foreground-secondary text-sm">
          Reported:{" "}
          <span className="text-foreground font-medium">{reportedName}</span>
        </p>
      ) : null}

      <p className="text-lg leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap">
        {feedback.details}
      </p>

      <dl className="grid gap-3 sm:grid-cols-2">
        <Fact Icon={MapTrifoldIcon} label="Where">
          {describeWhere(feedback)}
        </Fact>
        <Fact Icon={ClockIcon} label="When">
          <LocalDateTime iso={feedback.createdAt} />
        </Fact>
      </dl>

      {resolvedBy && feedback.resolvedAt ? (
        <p className="text-foreground-secondary text-sm">
          Resolved by {personName(resolvedBy)} ·{" "}
          {describeAge(feedback.resolvedAt, now)}
        </p>
      ) : null}
    </article>
  );
}
