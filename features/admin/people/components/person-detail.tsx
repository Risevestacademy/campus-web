import { CaretLeftIcon } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/ssr/EnvelopeSimple";
import { cn } from "cn";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Button, buttonVariants } from "@/shared/ui/button";

import { avatarTone, initialOf } from "../../feedback";
import { firstNameOf, personName, ROLE_LABELS } from "../people-format";
import { peopleHref } from "../people-href";
import {
  SAMPLE_HISTORY,
  SAMPLE_ON_CAMPUS,
  SAMPLE_STATS,
  type SampleOutcome,
} from "../person-detail-sample";
import type { Person } from "../types/people.types";
import { PersonStatus } from "./person-status";
import { RoleBadge } from "./role-badge";

const PANEL = "border-border rounded-3xl border p-6 dark:border-[#2B3B5F]";

const OUTCOME_CLASS_NAMES: Readonly<Record<SampleOutcome, string>> = {
  Absent: "text-error-700 dark:text-error-300",
  Partial: "text-lemon-800 dark:text-lemon-300",
  Present: "text-success-700 dark:text-success-300",
};

export function PersonDetail({
  cohortId,
  cohortName,
  person,
}: {
  cohortId: string;
  cohortName: string;
  person: Person;
}) {
  const name = personName(person);
  const firstName = firstNameOf(person);

  return (
    <section
      aria-labelledby="person-heading"
      className="grid content-start gap-6 p-10"
    >
      <header className="grid gap-2">
        <Link
          href={peopleHref(cohortId)}
          className="text-primary dark:text-cobalt-300 inline-flex w-fit items-center gap-1 text-sm font-medium"
        >
          <CaretLeftIcon aria-hidden size={14} />
          People
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1
              id="person-heading"
              className="font-display text-3xl font-semibold [overflow-wrap:anywhere]"
            >
              {name}
            </h1>
            <p className="text-foreground-secondary mt-1">
              {[
                person.role ? ROLE_LABELS[person.role] : undefined,
                person.trackName,
                cohortName,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <a
            href={`mailto:${person.email}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <EnvelopeSimpleIcon aria-hidden size={18} />
            Email {firstName}
          </a>
        </div>
      </header>

      <div className={cn(PANEL, "flex flex-wrap items-center gap-5")}>
        <Avatar className="size-20">
          <AvatarFallback className={cn(avatarTone(person.id), "text-3xl")}>
            {initialOf(name)}
          </AvatarFallback>
        </Avatar>
        <div className="grid gap-2">
          <p className="flex flex-wrap items-center gap-3">
            <span className="[overflow-wrap:anywhere]">{person.email}</span>
            <RoleBadge person={person} />
          </p>
          <PersonStatus
            cohortId={cohortId}
            userId={person.id}
            className="text-foreground-secondary"
          />
        </div>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SAMPLE_STATS.map(({ label, value, unit, note }) => (
          <div key={label} className={PANEL}>
            <dt className="text-foreground-secondary">{label}</dt>
            <dd className="mt-3">
              <span className="text-4xl font-semibold">{value}</span>
              {unit ? (
                <span className="text-foreground-secondary ml-2">{unit}</span>
              ) : null}
              <p className="text-foreground-secondary mt-3 text-sm">{note}</p>
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className={PANEL}>
          <h2 className="text-xl font-semibold">Attendance history</h2>
          <ul className="mt-4 grid">
            {SAMPLE_HISTORY.map((row, index) => (
              <li
                key={index}
                className="border-border flex items-center justify-between gap-4 border-b py-4 last:border-b-0 dark:border-[#2B3B5F]"
              >
                <div className="flex gap-6">
                  <p className="w-28 shrink-0">
                    {row.day}
                    <span className="text-foreground-secondary block text-sm">
                      {row.time}
                    </span>
                  </p>
                  <p>
                    {row.session}
                    <span className="text-foreground-secondary block text-sm">
                      {row.detail}
                    </span>
                  </p>
                </div>
                <span
                  className={cn(
                    "font-medium",
                    OUTCOME_CLASS_NAMES[row.outcome],
                  )}
                >
                  {row.outcome}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-6">
          <div className={PANEL}>
            <h2 className="text-xl font-semibold">On campus</h2>
            <dl className="mt-4 grid gap-4">
              {SAMPLE_ON_CAMPUS.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-foreground-secondary text-sm">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={PANEL}>
            <h2 className="text-xl font-semibold">Suggested next step</h2>
            <p className="text-foreground-secondary mt-4">
              {firstName} has missed 3 Design Foundations classes in a row, so a
              mentor check-in or an email works best.
            </p>
            <div className="mt-4 grid gap-3">
              <Button disabled>Ask mentor to check in</Button>
              <a
                href={`mailto:${person.email}`}
                className={buttonVariants({ variant: "outline" })}
              >
                <EnvelopeSimpleIcon aria-hidden size={18} />
                Email {firstName}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
