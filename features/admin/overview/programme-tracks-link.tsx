import { StackIcon } from "@phosphor-icons/react/dist/ssr/Stack";
import Link from "next/link";

import { cohortAdministrationHref } from "../cohort-administration-href";

export function ProgrammeTracksLink({ cohortId }: { cohortId: string }) {
  return (
    <nav aria-label="Administration areas">
      <Link
        href={cohortAdministrationHref(cohortId, "tracks")}
        className="border-border grid max-w-md grid-cols-[auto_1fr] gap-3 rounded-xl border p-5 transition-colors duration-150 hover:bg-[#E9ECF6] dark:border-[#2B3B5F] dark:hover:bg-[#2B3B5F]"
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
  );
}
