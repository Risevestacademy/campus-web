import { StackIcon } from "@phosphor-icons/react/dist/ssr/Stack";
import type { Route } from "next";
import Link from "next/link";

export function AdminOverview({ cohortId }: { cohortId: string }) {
  const tracksHref = `/campus/${encodeURIComponent(cohortId)}/tracks` as Route;

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
          Manage this Campus without leaving the Campus workspace.
        </p>
      </header>

      <nav aria-label="Administration areas">
        <Link
          href={tracksHref}
          className="border-border hover:bg-accent grid max-w-md grid-cols-[auto_1fr] gap-3 rounded-xl border p-5 transition-colors duration-150"
        >
          <StackIcon aria-hidden size={22} />
          <span className="grid gap-1">
            <span className="font-medium">Cohorts &amp; tracks</span>
            <span className="text-foreground-secondary text-sm">
              Inspect, attach, and detach Programme Tracks.
            </span>
          </span>
        </Link>
      </nav>
    </section>
  );
}
