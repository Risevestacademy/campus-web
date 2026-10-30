import "server-only";

import Link from "next/link";

import { getServerApi } from "@/core/api/client/server";

import { peopleHref } from "../people-href";
import { readPersonCard } from "../services/people-api.adapter";
import { PersonDetail } from "./person-detail";

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <section className="grid content-start gap-4 p-10">
      <p
        role="alert"
        className="border-border text-foreground-secondary rounded-3xl border p-6 dark:border-[#2B3B5F]"
      >
        {children}
      </p>
    </section>
  );
}

export async function PersonAdministration({
  cohortId,
  userId,
}: {
  cohortId: string;
  userId: string;
}) {
  const read = await readPersonCard(await getServerApi(), userId);

  if (read.kind === "missing") {
    return (
      <Notice>
        This person no longer exists.{" "}
        <Link className="text-primary underline" href={peopleHref(cohortId)}>
          Back to people
        </Link>
      </Notice>
    );
  }
  if (read.kind === "unavailable") {
    return <Notice>We couldn&apos;t load this person. Try again.</Notice>;
  }

  return <PersonDetail cohortId={cohortId} card={read.card} />;
}
