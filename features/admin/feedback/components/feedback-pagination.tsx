import Link from "next/link";

import { buttonVariants } from "@/shared/ui/button";

import { feedbackAdministrationHref } from "../feedback-href";
import type { FeedbackFilter, FeedbackTab } from "../types/feedback.types";

export function FeedbackPagination({
  cohortId,
  tab,
  filter,
  page,
  totalPages,
}: {
  cohortId: string;
  tab: FeedbackTab;
  filter: FeedbackFilter;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Feedback pages"
      className="flex items-center justify-center gap-4"
    >
      {page > 1 ? (
        <Link
          href={feedbackAdministrationHref(cohortId, {
            tab,
            filter,
            page: page - 1,
          })}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Previous page
        </Link>
      ) : null}
      <span className="text-foreground-secondary text-sm">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={feedbackAdministrationHref(cohortId, {
            tab,
            filter,
            page: page + 1,
          })}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Next page
        </Link>
      ) : null}
    </nav>
  );
}
