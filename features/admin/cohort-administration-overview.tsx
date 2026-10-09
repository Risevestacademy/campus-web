import { StackIcon } from "@phosphor-icons/react/dist/ssr/Stack";
import Link from "next/link";

import { cohortAdministrationHref } from "./cohort-administration-href";

export function CohortAdministrationOverview({
  cohortId,
}: {
  cohortId: string;
}) {
  return (
    <section
      aria-labelledby="administration-overview-heading"
      className="grid gap-8 p-10"
    >
      <header className="grid gap-2">
        <h1
          id="administration-overview-heading"
          className="text-2xl font-semibold"
        >
          Administration overview
        </h1>
        <p className="text-foreground-secondary">
          Manage this Cohort without leaving the Campus Shell.
        </p>
      </header>

      <nav aria-label="Administration areas">
        <Link
          href={cohortAdministrationHref(cohortId, "tracks")}
          className="border-border hover:bg-accent grid max-w-md grid-cols-[auto_1fr] gap-3 rounded-xl border p-5 transition-colors duration-150"
        >
          <StackIcon aria-hidden size={22} />
          <span className="grid gap-1">
            <span className="font-medium">Programme Tracks</span>
            <span className="text-foreground-secondary text-sm">
              Inspect, attach, and detach Programme Tracks.
            </span>
          </span>
        </Link>
      </nav>
    </section>
  );
}
