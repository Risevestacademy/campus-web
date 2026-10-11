import { cn } from "cn";
import type { Route } from "next";
import Link from "next/link";

import { withCampusPreJoinCompletion } from "@/core/navigation";
import { CohortGate, normalizeCohortReturnTo } from "@/features/auth";
import { VisualsDisplay } from "@/features/campus";
import { CampusMapPreparationGate } from "@/features/campus-world";
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
  const destination = withCampusPreJoinCompletion(
    normalizeCohortReturnTo(id, firstSearchParameter(returnTo)),
  ) as Route;

  return (
    <CohortGate cohortId={id}>
      <CampusMapPreparationGate>
        <main className="grid h-dvh content-center gap-6">
          <VisualsDisplay />

          <Link
            href={destination}
            className={cn(buttonVariants({ size: "lg" }), "mx-auto min-w-40")}
          >
            Join
          </Link>
        </main>
      </CampusMapPreparationGate>
    </CohortGate>
  );
}
