import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/shared/ui/button";

import { type FeedbackType, feedbackTypeDetails } from "../feedback";

export interface AttentionItem {
  id: string;
  type: FeedbackType;
  title: string;
  age: string;
  href: Route;
}

export function NeedsAttentionCard({
  items,
  emptyMessage,
}: {
  items: readonly AttentionItem[];
  emptyMessage: ReactNode;
}) {
  return (
    <section
      aria-labelledby="needs-attention-heading"
      className="border-border grid content-start gap-5 rounded-2xl border p-6 dark:border-[#2B3B5F]"
    >
      <header className="flex items-baseline justify-between gap-4">
        <h2
          id="needs-attention-heading"
          className="font-display text-xl font-semibold"
        >
          Needs attention
        </h2>
        <p className="text-error-700 dark:text-error-300 text-sm">
          {items.length} new
        </p>
      </header>

      {items.length === 0 ? (
        <p className="text-foreground-secondary text-sm">{emptyMessage}</p>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => {
            const { Icon, className, label } = feedbackTypeDetails(item.type);

            return (
              <li
                key={item.id}
                className="flex items-center gap-4 rounded-xl bg-[#EFFAFF] p-3 dark:bg-[#2B3B5F]"
              >
                <span
                  role="img"
                  aria-label={label}
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${className}`}
                >
                  <Icon aria-hidden size={20} />
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate text-sm font-medium">
                    {item.title}
                  </span>
                  <span className="text-foreground-secondary truncate text-sm">
                    {item.age}
                  </span>
                </span>
                <Link
                  href={item.href}
                  aria-label={`Review ${item.title}`}
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                  })}
                >
                  Review
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
