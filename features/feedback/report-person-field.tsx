"use client";

import { useId, useState } from "react";

import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";

import { FIELD_CLASS, FieldError } from "./form-field";
import { useCohortPeople } from "./hooks/use-cohort-people";
import type { CohortPerson } from "./schemas/people.schema";

const MAX_SHOWN = 50;

function nameOf(person: CohortPerson): string {
  return person.displayName?.trim() || "Unnamed member";
}

function nameKey(person: CohortPerson): string {
  return nameOf(person).toLowerCase();
}

// People with no name can't be told apart by it, so they are not marked.
function namesShared(people: readonly CohortPerson[]): ReadonlySet<string> {
  const seen = new Set<string>();
  const shared = new Set<string>();
  for (const person of people) {
    if (!person.displayName?.trim()) continue;
    const key = nameKey(person);
    if (seen.has(key)) shared.add(key);
    seen.add(key);
  }
  return shared;
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
  const [selectedId, setSelectedId] = useState("");
  // Looked up each time, so a person who has left the list is no longer picked.
  const selected = people.find((person) => person.id === selectedId);
  const needle = search.trim().toLowerCase();
  const sharedNames = namesShared(people);
  const found = people.filter((person) =>
    nameOf(person).toLowerCase().includes(needle),
  );
  const matches = found.slice(0, MAX_SHOWN);

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
        onValueChange={(value) => setSelectedId(String(value))}
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
      {found.length > matches.length ? (
        <p className="text-foreground-secondary text-sm">
          Showing the first {MAX_SHOWN} of {found.length} people. Type a name to
          narrow the list.
        </p>
      ) : null}
      {selected ? (
        <p className="text-foreground-secondary text-sm">
          Reporting {nameOf(selected)}
          {sharedNames.has(nameKey(selected))
            ? ". Someone else has this name, so say where you saw them in the details."
            : null}
        </p>
      ) : null}
      <input type="hidden" name="personRequired" value="yes" />
      <input type="hidden" name="reportedUserId" value={selected?.id ?? ""} />
      <FieldError message={error} />
    </div>
  );
}

// A member picks from the cohort. When the cohort can't be listed, or lists
// nobody else, the report still goes, with who it is about left to the
// details, so a failed lookup never blocks one.
export function ReportPersonField({
  cohortId,
  userId,
  error,
}: {
  cohortId: string | undefined;
  userId: string | undefined;
  error: string | undefined;
}) {
  const id = useId();
  const read = useCohortPeople(cohortId);

  if (cohortId !== undefined && read === undefined) {
    return (
      <div className="grid gap-2">
        <p role="status" className="text-foreground-secondary text-sm">
          Loading people…
        </p>
        <input type="hidden" name="personRequired" value="yes" />
        <FieldError message={error} />
      </div>
    );
  }

  const people =
    read?.kind === "loaded"
      ? read.people.filter((person) => person.id !== userId)
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
