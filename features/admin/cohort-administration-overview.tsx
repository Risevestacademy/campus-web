import "server-only";

import { CalendarBlankIcon } from "@phosphor-icons/react/dist/ssr/CalendarBlank";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { MapTrifoldIcon } from "@phosphor-icons/react/dist/ssr/MapTrifold";
import { cn } from "cn";
import type { Route } from "next";
import Link from "next/link";

import { getServerApi } from "@/core/api/client/server";
import { Button, buttonVariants } from "@/shared/ui/button";

import {
  attentionItems,
  describeAge,
  feedbackAdministrationHref,
  isMissingData,
  loadOpenFeedback,
  openCounts,
} from "./feedback";
import {
  type AttentionItem,
  NeedsAttentionCard,
} from "./overview/needs-attention-card";
import { mockOverview, type OverviewStat } from "./overview/overview-data";
import { OverviewGreeting } from "./overview/overview-greeting";
import { OverviewStatCards } from "./overview/overview-stat-cards";
import { ProgrammeTracksLink } from "./overview/programme-tracks-link";
import { TodayScheduleCard } from "./overview/today-schedule-card";

function firstNameOf(
  displayName: string | null | undefined,
): string | undefined {
  return displayName?.trim().split(/\s+/)[0] || undefined;
}

function countText(count: number | undefined): string {
  return count === undefined ? "—" : String(count);
}

export async function CohortAdministrationOverview({
  cohortId,
  adminName,
}: {
  cohortId: string;
  adminName?: string | null;
}) {
  const open = await loadOpenFeedback(await getServerApi());
  const counts = openCounts(open);
  const reviewStat: OverviewStat = {
    id: "review",
    label: "Needs review",
    value: countText(counts.all),
    caption: `Reports: ${countText(counts.reports)} · Feedback: ${countText(counts.feedback)}`,
  };
  const attention: AttentionItem[] = attentionItems(open).map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    age: describeAge(item.createdAt, open.now),
    href: feedbackAdministrationHref(cohortId, {
      tab: item.type === "report" ? "reports" : "feedback",
      itemId: item.id,
    }),
  }));

  return (
    <section
      aria-labelledby="administration-overview-heading"
      className="grid gap-6 p-10"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1.5">
          <h1
            id="administration-overview-heading"
            className="font-display text-3xl font-semibold"
          >
            <OverviewGreeting firstName={firstNameOf(adminName)} />
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm">
            <CalendarBlankIcon aria-hidden />
            {mockOverview.period}
            <CaretDownIcon aria-hidden />
          </Button>
          <Link
            href={`/campus/${encodeURIComponent(cohortId)}` as Route}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <MapTrifoldIcon aria-hidden />
            Open campus
          </Link>
        </div>
      </header>

      <OverviewStatCards stats={[...mockOverview.stats, reviewStat]} />

      <div className="grid gap-6 xl:grid-cols-2">
        <NeedsAttentionCard
          items={attention}
          emptyMessage={
            isMissingData(open)
              ? "We couldn't load feedback right now."
              : "Nothing needs attention right now."
          }
        />
        <TodayScheduleCard
          label={mockOverview.today.label}
          schedule={mockOverview.today.schedule}
        />
      </div>

      <ProgrammeTracksLink cohortId={cohortId} />
    </section>
  );
}
