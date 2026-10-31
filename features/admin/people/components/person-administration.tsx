import "server-only";

import Link from "next/link";

import { getServerApi } from "@/core/api/client/server";

import { peopleHref } from "../people-href";
import { readPerson } from "../services/person-read.service";
import { Notice } from "./notice";
import { PersonDetail } from "./person-detail";

function Page({ children }: { children: React.ReactNode }) {
  return (
    <section className="grid content-start gap-4 p-10">
      <Notice>{children}</Notice>
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
  const read = await readPerson(await getServerApi(), cohortId, userId);

  if (read.kind === "missing") {
    return (
      <Page>
        We can&apos;t show this person here. They may not be in this cohort, or
        their account may be suspended.{" "}
        <Link className="text-primary underline" href={peopleHref(cohortId)}>
          Back to people
        </Link>
      </Page>
    );
  }
  if (read.kind === "unavailable") {
    return <Page>We couldn&apos;t load this person. Try again.</Page>;
  }

  return (
    <PersonDetail
      cohortId={cohortId}
      cohortName={read.cohortName}
      person={read.person}
    />
  );
}
