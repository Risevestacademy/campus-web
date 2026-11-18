import Link from "next/link";

import { describeAge, personName } from "../feedback-format";
import { feedbackAdministrationHref } from "../feedback-href";
import type {
  FeedbackFilter,
  FeedbackPage,
  FeedbackSummary,
} from "../types/feedback.types";
import { FeedbackStatusLabel } from "./feedback-status-label";
import { FeedbackTypeBadge } from "./feedback-type-badge";

function subtitle(item: FeedbackSummary, now: number): string {
  return [
    personName(item.submittedBy),
    item.about,
    describeAge(item.createdAt, now),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function FeedbackQueue({
  cohortId,
  filter,
  page,
  now,
  selectedId,
}: {
  cohortId: string;
  filter: FeedbackFilter;
  page: FeedbackPage;
  now: number;
  selectedId: string | undefined;
}) {
  return (
    <section
      aria-label="Feedback"
      className="border-border grid content-start gap-1 rounded-3xl border p-3 dark:border-[#2B3B5F]"
    >
      <ul className="grid gap-1">
        {page.items.map((item) => (
          <li key={item.id}>
            <Link
              href={feedbackAdministrationHref(cohortId, {
                tab: "feedback",
                filter,
                page: page.page,
                itemId: item.id,
              })}
              aria-current={item.id === selectedId ? "true" : undefined}
              className="aria-[current=true]:border-cobalt-500 dark:aria-[current=true]:border-cobalt-400 grid min-w-0 gap-2 rounded-2xl border border-transparent p-3 hover:bg-[#E9ECF6] aria-[current=true]:bg-[#E9ECF6] dark:hover:bg-[#2B3B5F] dark:aria-[current=true]:bg-[#2B3B5F]"
            >
              <span className="flex items-center justify-between gap-3">
                <FeedbackTypeBadge type={item.type} />
                <FeedbackStatusLabel status={item.status} />
              </span>
              <span className="font-medium [overflow-wrap:anywhere]">
                {item.title}
              </span>
              <span className="text-foreground-secondary truncate text-sm">
                {subtitle(item, now)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {page.truncated ? (
        <p className="text-foreground-secondary px-3 py-2 text-sm">
          Showing the newest 100 of each kind, so paging stops there. Filter by
          Bugs or Ideas to reach older items.
        </p>
      ) : null}
    </section>
  );
}
