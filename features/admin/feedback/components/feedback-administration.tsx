import "server-only";

import { LockIcon } from "@phosphor-icons/react/dist/ssr/Lock";
import { cn } from "cn";
import Link from "next/link";
import type { ReactNode } from "react";

import { getServerApi } from "@/core/api/client/server";

import { feedbackAdministrationHref } from "../feedback-href";
import { parseFeedbackQuery } from "../schemas/feedback-query.schema";
import { filtersFor } from "../schemas/feedback-query.schema";
import {
  type FeedbackView,
  loadFeedbackView,
} from "../services/feedback-view.service";
import type {
  FeedbackFilter,
  FeedbackQuery,
  FeedbackTab,
} from "../types/feedback.types";
import { FeedbackDetail } from "./feedback-detail";
import { FeedbackPagination } from "./feedback-pagination";
import { FeedbackQueue } from "./feedback-queue";
import { ReportsTable } from "./reports-table";

const FILTER_LABELS: Readonly<Record<FeedbackFilter, string>> = {
  all: "All",
  open: "Open",
  resolved: "Resolved",
  bug: "Bugs",
  idea: "Ideas",
};

const SUBTITLES: Readonly<Record<FeedbackTab, string>> = {
  feedback: "What students and staff send from the Feedback button on Campus",
  reports: "People reports from Campus · only admins see who reported",
};

function Notice({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="border-border text-foreground-secondary rounded-3xl border p-6 dark:border-[#2B3B5F]"
    >
      {children}
    </p>
  );
}

function TabLink({
  cohortId,
  tab,
  active,
  label,
  count,
  countClassName,
}: {
  cohortId: string;
  tab: FeedbackTab;
  active: boolean;
  label: string;
  count: number | undefined;
  countClassName: string;
}) {
  return (
    <Link
      href={feedbackAdministrationHref(cohortId, { tab })}
      aria-current={active ? "page" : undefined}
      className="text-foreground-secondary hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:text-primary dark:aria-[current=page]:text-cobalt-300 dark:aria-[current=page]:border-cobalt-300 -mb-px flex items-center gap-2 border-b-2 border-transparent px-1 pb-3 font-medium"
    >
      {label}
      {count === undefined ? null : (
        <span className={cn("rounded-full px-2 text-sm", countClassName)}>
          {count}
        </span>
      )}
    </Link>
  );
}

function FilterLinks({
  cohortId,
  query,
  view,
}: {
  cohortId: string;
  query: FeedbackQuery;
  view: FeedbackView;
}) {
  return (
    <nav aria-label="Filter">
      <ul className="flex flex-wrap gap-2">
        {filtersFor(query.tab).map((filter) => {
          const count = view.counts.filters[filter];

          return (
            <li key={filter}>
              <Link
                href={feedbackAdministrationHref(cohortId, {
                  tab: query.tab,
                  filter,
                })}
                aria-current={filter === query.filter ? "true" : undefined}
                className="border-border dark:aria-[current=true]:bg-primary inline-flex items-center rounded-full border px-4 py-2 text-sm hover:bg-[#E9ECF6] aria-[current=true]:border-transparent aria-[current=true]:bg-[#152228] aria-[current=true]:text-[#F7F7F7] dark:border-[#2B3B5F] dark:hover:bg-[#2B3B5F]"
              >
                {FILTER_LABELS[filter]}
                {count === undefined ? null : ` ${count}`}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DetailPanel({
  detail,
  now,
  className,
}: {
  detail: FeedbackView["detail"];
  now: number;
  className?: string;
}) {
  if (!detail) return null;
  if (detail.kind === "missing") {
    return <Notice>This item no longer exists.</Notice>;
  }
  if (detail.kind === "unavailable") {
    return <Notice>We couldn&apos;t load this item. Try again.</Notice>;
  }

  return (
    <FeedbackDetail
      feedback={detail.feedback}
      now={now}
      className={className}
    />
  );
}

function FeedbackTabContent({
  cohortId,
  query,
  view,
}: {
  cohortId: string;
  query: FeedbackQuery;
  view: FeedbackView;
}) {
  const { list, detail, now } = view;

  if (list.kind === "unavailable") {
    return (
      <Notice>
        We couldn&apos;t load feedback.{" "}
        <Link
          className="text-primary underline"
          href={feedbackAdministrationHref(cohortId, query)}
        >
          Try again
        </Link>
      </Notice>
    );
  }
  if (list.items.length === 0) {
    return <Notice>No feedback here yet.</Notice>;
  }

  const selectedId =
    detail?.kind === "loaded" ? detail.feedback.id : query.itemId;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="grid gap-4">
        <FeedbackQueue
          cohortId={cohortId}
          filter={query.filter}
          page={list}
          now={now}
          selectedId={selectedId}
        />
        <FeedbackPagination
          cohortId={cohortId}
          tab="feedback"
          filter={query.filter}
          page={list.page}
          totalPages={list.totalPages}
        />
      </div>
      <DetailPanel detail={detail} now={now} />
    </div>
  );
}

function ReportsTabContent({
  cohortId,
  query,
  view,
}: {
  cohortId: string;
  query: FeedbackQuery;
  view: FeedbackView;
}) {
  const { list, detail, now } = view;

  if (list.kind === "unavailable") {
    return (
      <Notice>
        We couldn&apos;t load reports.{" "}
        <Link
          className="text-primary underline"
          href={feedbackAdministrationHref(cohortId, query)}
        >
          Try again
        </Link>
      </Notice>
    );
  }

  return (
    <div className="grid gap-6">
      {list.items.length === 0 ? (
        <Notice>No reports here.</Notice>
      ) : (
        <ReportsTable
          cohortId={cohortId}
          filter={query.filter}
          page={list}
          now={now}
        />
      )}
      <FeedbackPagination
        cohortId={cohortId}
        tab="reports"
        filter={query.filter}
        page={list.page}
        totalPages={list.totalPages}
      />
      <DetailPanel detail={detail} now={now} />
      <p className="flex items-start gap-3 rounded-2xl bg-[#EFFAFF] p-4 text-sm dark:bg-[#2B3B5F]">
        <LockIcon
          aria-hidden
          size={18}
          className="text-icon-muted mt-0.5 shrink-0"
        />
        Reporters stay anonymous to the person reported. Campus never records
        audio or what&apos;s said in private rooms; reports include only what
        the reporter shares and basic presence context.
      </p>
    </div>
  );
}

export function FeedbackAdministrationView({
  cohortId,
  query,
  view,
}: {
  cohortId: string;
  query: FeedbackQuery;
  view: FeedbackView;
}) {
  return (
    <section
      aria-labelledby="feedback-heading"
      className="grid content-start gap-6 p-10"
    >
      <header className="grid gap-1.5">
        <h1
          id="feedback-heading"
          className="font-display text-3xl font-semibold"
        >
          Feedback &amp; reports
        </h1>
        <p className="text-foreground-secondary flex items-center gap-2">
          <span aria-hidden className="bg-success-500 size-2 rounded-full" />
          {SUBTITLES[query.tab]}
        </p>
      </header>

      <nav
        aria-label="Feedback sections"
        className="border-border flex gap-8 border-b dark:border-[#2B3B5F]"
      >
        <TabLink
          cohortId={cohortId}
          tab="feedback"
          active={query.tab === "feedback"}
          label="Feedback"
          count={view.counts.feedback}
          countClassName="bg-cobalt-100 text-cobalt-700 dark:bg-[#2B3B5F] dark:text-cobalt-200"
        />
        <TabLink
          cohortId={cohortId}
          tab="reports"
          active={query.tab === "reports"}
          label="Reports"
          count={view.counts.openReports}
          countClassName="text-error-700 dark:text-error-300"
        />
      </nav>

      <FilterLinks cohortId={cohortId} query={query} view={view} />

      {query.tab === "feedback" ? (
        <FeedbackTabContent cohortId={cohortId} query={query} view={view} />
      ) : (
        <ReportsTabContent cohortId={cohortId} query={query} view={view} />
      )}
    </section>
  );
}

export async function FeedbackAdministration({
  cohortId,
  rawQuery,
}: {
  cohortId: string;
  rawQuery: { tab?: string; filter?: string; page?: string; item?: string };
}) {
  const query = parseFeedbackQuery(rawQuery);
  const view = await loadFeedbackView(await getServerApi(), query);

  return (
    <FeedbackAdministrationView cohortId={cohortId} query={query} view={view} />
  );
}
