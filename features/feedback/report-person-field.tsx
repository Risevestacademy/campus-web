"use client";

import { useId, useState } from "react";

import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";

import { useCohortPeople } from "./hooks/use-cohort-people";
import type { CohortPerson } from "./schemas/people.schema";

const MAX_SHOWN = 50;
const FIELD_CLASS =
  "h-11 rounded-xl px-4 text-base focus-visible:border-[#3155D6] dark:border-[#2B3B5F] dark:focus-visible:border-[#3155D6]";

function nameOf(person: CohortPerson): string {
  return person.displayName?.trim() || "Unnamed member";
}

function nameKey(person: CohortPerson): string {
  return nameOf(person).toLowerCase();
}

function namesShared(people: readonly CohortPerson[]): ReadonlySet<string> {
  const seen = new Set<string>();
  const shared = new Set<string>();
  for (const person of people) {
    const key = nameKey(person);
    if (seen.has(key)) shared.add(key);
    seen.add(key);
  }
  return shared;
}

function FieldError({ message }: { message: string | undefined }) {
  return message ? (
    <p role="alert" className="text-destructive text-sm">
      {message}
    </p>
  ) : null;
}

function PersonPicker({
  id,
  people,
  error,
}: {
  id: string;
  people: readonly CohortPerson[];
  error: string | undefined;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CohortPerson>();
  const needle = search.trim().toLowerCase();
  const sharedNames = namesShared(people);
  const matches = people
    .filter((person) => nameOf(person).toLowerCase().includes(needle))
    .slice(0, MAX_SHOWN);

  return (
    <div className="grid gap-2">
      <Label id={`${id}-label`} htmlFor={`${id}-search`}>
        Who are you reporting?
      </Label>
      <Input
        id={`${id}-search`}
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by name"
        aria-invalid={error ? true : undefined}
        className={FIELD_CLASS}
      />
      <RadioGroup
        aria-labelledby={`${id}-label`}
        value={selected?.id ?? ""}
        onValueChange={(value) =>
          setSelected(people.find((person) => person.id === value))
        }
        className="border-input max-h-48 gap-0 overflow-y-auto rounded-xl border p-1 dark:border-[#2B3B5F]"
      >
        {matches.map((person) => (
          <Label
            key={person.id}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 font-normal hover:bg-[#E9ECF6] dark:hover:bg-[#2B3B5F]"
          >
            <RadioGroupItem value={person.id} />
            {nameOf(person)}
            {sharedNames.has(nameKey(person)) ? (
              <span className="text-foreground-secondary text-xs">
                Same name as someone else
              </span>
            ) : null}
          </Label>
        ))}
        {matches.length === 0 ? (
          <p className="text-foreground-secondary px-3 py-2.5 text-sm">
            No one matches that name.
          </p>
        ) : null}
      </RadioGroup>
      {selected ? (
        <p className="text-foreground-secondary text-sm">
          Reporting {nameOf(selected)}
          {sharedNames.has(nameKey(selected))
            ? ". Someone else has this name, so say where you saw them in the details."
            : null}
        </p>
      ) : null}
      <input type="hidden" name="reportedUserId" value={selected?.id ?? ""} />
      <input
        type="hidden"
        name="reported"
        value={selected ? nameOf(selected) : ""}
      />
      <FieldError message={error} />
    </div>
  );
}

// A member picks from the cohort. When the cohort can't be listed, or lists
// nobody else, the report still goes, with who it is about left to the
// details, so a failed lookup never blocks one.
export function ReportPersonField({
  cohortId,
  selfId,
  error,
}: {
  cohortId: string | undefined;
  selfId: string | undefined;
  error: string | undefined;
}) {
  const id = useId();
  const read = useCohortPeople({ cohortId, enabled: true });

  if (cohortId !== undefined && read === undefined) {
    return (
      <div className="grid gap-2">
        <p role="status" className="text-foreground-secondary text-sm">
          Loading people…
        </p>
        <input type="hidden" name="reportedUserId" value="" />
        <FieldError message={error} />
      </div>
    );
  }

  const people =
    read?.kind === "loaded"
      ? read.people.filter((person) => person.id !== selfId)
      : [];

  if (people.length > 0) {
    return <PersonPicker id={id} people={people} error={error} />;
  }

  return (
    <p className="text-foreground-secondary text-sm">
      We can&apos;t list the people in this cohort right now. Say who you are
      reporting in the details.
    </p>
  );
}
