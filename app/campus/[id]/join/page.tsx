import { cn } from "cn";
import type { Route } from "next";

import {
  CampusEntryLink,
  CohortGate,
  normalizeCohortReturnTo,
} from "@/features/auth";
import { VisualsDisplay } from "@/features/campus";
import { firstSearchParameter } from "@/shared/lib/search-params";
import { buttonVariants } from "@/shared/ui/button";

interface JoinPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}

export default async function JoinPage({
  params,
  searchParams,
}: JoinPageProps) {
  const [{ id }, { returnTo }] = await Promise.all([params, searchParams]);
  const destination = normalizeCohortReturnTo(
    id,
    firstSearchParameter(returnTo),
  ) as Route;

  return (
    <CohortGate cohortId={id}>
      <main className="grid h-dvh content-center gap-6">
        <VisualsDisplay />

        <CampusEntryLink
          cohortId={id}
          href={destination}
          className={cn(buttonVariants({ size: "lg" }), "mx-auto min-w-40")}
        >
          Join
        </CampusEntryLink>
      </main>
    </CohortGate>
  );
}
