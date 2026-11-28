"use client";

import { type KeyboardEvent, useId, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/native-select";

import { ROLE_LABELS } from "../../role-labels";
import { usePersonSearch } from "../hooks/use-person-search";
import { useSpaceGrants } from "../hooks/use-space-grants";
import type {
  CohortRole,
  EndGrantProblem,
  GrantOption,
  GrantSubject,
  GrantTarget,
  SpaceAccess,
  SpaceGrantProblem,
} from "../types/maps.types";
import { useGrantOptions } from "./grant-options-context";

const GRANT_PROBLEMS: Readonly<Record<SpaceGrantProblem, string | undefined>> =
  {
    conflict:
      "They're already on the list, or this space has been retired and takes no one new.",
    invalid: "campus-api refused that. Refresh the page and try again.",
    missing:
      "That person, track or group no longer exists, or the space is gone. Refresh the page.",
    "signed-out": undefined,
    forbidden: "Only administrators can change who may enter.",
    unavailable: "We couldn't add them. Check your connection and try again.",
  };

const END_PROBLEMS: Readonly<Record<EndGrantProblem, string | undefined>> = {
  "already-ended": "That access has already ended.",
  missing: "That entry is no longer on the list. Close and reopen the space.",
  invalid: "campus-api refused that. Refresh the page and try again.",
  "signed-out": undefined,
  forbidden: "Only administrators can change who may enter.",
  unavailable: "We couldn't remove them. Check your connection and try again.",
};

type AddKind = GrantTarget["type"];

const ADD_KINDS: Readonly<Record<AddKind, string>> = {
  user: "A person",
  cohort_track: "Everyone on a track",
  mentorship_group: "A mentorship group",
  cohort_role: "Everyone with a role",
};

const SYSTEM_ROLE_LABELS: Readonly<
  Record<NonNullable<GrantSubject["systemRole"]>, string>
> = {
  user: "Everyone with an account",
  admin: "All admins",
  super_admin: "All super admins",
};

export function subjectLabel(subject: GrantSubject): string {
  switch (subject.type) {
    case "user":
      return subject.displayName ?? subject.email ?? "Someone";
    case "cohort_track":
      return `${subject.trackName ?? "A"} track`;
    case "mentorship_group":
      return `${subject.groupName ?? "A"} mentorship group`;
    case "cohort_role":
      return subject.cohortRole
        ? `All ${ROLE_LABELS[subject.cohortRole].toLowerCase()}s`
        : "Everyone with a role";
    case "system_role":
      return subject.systemRole
        ? SYSTEM_ROLE_LABELS[subject.systemRole]
        : "Everyone with a role";
  }
}

// Enter in a field of the list adds nothing and must not save the space form
// around it.
function holdEnter(event: KeyboardEvent<HTMLElement>) {
  if (event.key === "Enter") event.preventDefault();
}

export function SpaceAccessList({
  spaceId,
  savedAccess,
}: {
  spaceId: string;
  savedAccess: SpaceAccess;
}) {
  const id = useId();
  const { read, isLoading, granting, ending } = useSpaceGrants(spaceId);
  const [addKind, setAddKind] = useState<AddKind>("user");
  const live = read?.kind === "loaded" ? read.grants.filter((g) => g.live) : [];
  const message =
    (granting.problem ? GRANT_PROBLEMS[granting.problem] : undefined) ??
    (ending.problem ? END_PROBLEMS[ending.problem] : undefined);

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="border-border grid gap-3 rounded-xl border p-3"
    >
      <h3 id={`${id}-heading`} className="text-sm font-semibold">
        On the list
      </h3>

      {savedAccess !== "designated" ? (
        <p className="text-foreground-secondary text-xs">
          The list applies once you save the space with “Only people on its
          list”.
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-foreground-secondary text-sm">Loading the list…</p>
      ) : read?.kind !== "loaded" ? (
        <p role="alert" className="text-destructive text-sm">
          We couldn&apos;t load the list. Close the space and open it again.
        </p>
      ) : live.length === 0 ? (
        <p className="text-foreground-secondary text-sm">
          Nobody is on the list yet, so only admins can enter.
        </p>
      ) : (
        <ul className="grid gap-1">
          {live.map((grant) => {
            const label = subjectLabel(grant.subject);
            return (
              <li
                key={grant.id}
                className="bg-surface flex min-h-9 items-center justify-between gap-2 rounded-lg pr-1 pl-3 text-sm"
              >
                <span className="truncate">{label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={ending.isPending}
                  aria-label={`Remove ${label} from the list`}
                  onClick={() => ending.mutate(grant.id)}
                >
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {message ? (
        <p role="alert" className="text-destructive text-sm">
          {message}
        </p>
      ) : null}

      <div className="grid gap-2">
        <label htmlFor={`${id}-add`} className="text-xs font-medium">
          Add
        </label>
        <NativeSelect
          id={`${id}-add`}
          value={addKind}
          onChange={(event) => setAddKind(event.target.value as AddKind)}
        >
          {Object.entries(ADD_KINDS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
        {addKind === "user" ? (
          <PersonPicker
            busy={granting.isPending}
            onPick={(userId) => granting.mutate({ type: "user", userId })}
          />
        ) : addKind === "cohort_role" ? (
          <OptionPicker
            label="Role"
            options={Object.entries(ROLE_LABELS).map(([value, name]) => ({
              id: value,
              name: `All ${name.toLowerCase()}s`,
            }))}
            empty=""
            busy={granting.isPending}
            onPick={(role) =>
              granting.mutate({
                type: "cohort_role",
                cohortRole: role as CohortRole,
              })
            }
          />
        ) : addKind === "cohort_track" ? (
          <TrackOrGroupPicker
            kind="tracks"
            busy={granting.isPending}
            onPick={(cohortTrackId) =>
              granting.mutate({ type: "cohort_track", cohortTrackId })
            }
          />
        ) : (
          <TrackOrGroupPicker
            kind="groups"
            busy={granting.isPending}
            onPick={(mentorshipGroupId) =>
              granting.mutate({ type: "mentorship_group", mentorshipGroupId })
            }
          />
        )}
      </div>
    </section>
  );
}

function TrackOrGroupPicker({
  kind,
  busy,
  onPick,
}: {
  kind: "tracks" | "groups";
  busy: boolean;
  onPick: (id: string) => void;
}) {
  const { options } = useGrantOptions();
  const choices = options[kind];
  if (choices === null) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {kind === "tracks"
          ? "We couldn't load this cohort's tracks. Refresh the page to try again."
          : "We couldn't load this cohort's mentorship groups. Refresh the page to try again."}
      </p>
    );
  }
  return (
    <OptionPicker
      label={kind === "tracks" ? "Track" : "Mentorship group"}
      options={choices}
      empty={
        kind === "tracks"
          ? "This cohort runs no tracks yet."
          : "This cohort has no mentorship groups yet."
      }
      busy={busy}
      onPick={onPick}
    />
  );
}

function OptionPicker({
  label,
  options,
  empty,
  busy,
  onPick,
}: {
  label: string;
  options: readonly GrantOption[];
  empty: string;
  busy: boolean;
  onPick: (id: string) => void;
}) {
  const [chosen, setChosen] = useState(options[0]?.id ?? "");
  if (options.length === 0) {
    return <p className="text-foreground-secondary text-sm">{empty}</p>;
  }

  return (
    <div className="flex gap-2">
      <NativeSelect
        aria-label={label}
        value={chosen}
        onChange={(event) => setChosen(event.target.value)}
        onKeyDown={holdEnter}
        className="min-w-0 flex-1"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </NativeSelect>
      <Button
        type="button"
        variant="outline"
        disabled={busy || chosen === ""}
        onClick={() => onPick(chosen)}
      >
        Add
      </Button>
    </div>
  );
}

function PersonPicker({
  busy,
  onPick,
}: {
  busy: boolean;
  onPick: (userId: string) => void;
}) {
  const { cohortId } = useGrantOptions();
  const found = usePersonSearch(cohortId);
  const people = found.read?.kind === "loaded" ? found.read.people : [];

  return (
    <div className="grid gap-1.5">
      <Input
        type="search"
        aria-label="Search people by name or email"
        placeholder="Search by name or email"
        autoComplete="off"
        value={found.text}
        onChange={(event) => found.type(event.target.value)}
        onKeyDown={holdEnter}
      />
      {!found.ready ? null : found.isLoading ? (
        <p className="text-foreground-secondary text-xs">Searching…</p>
      ) : found.read?.kind !== "loaded" ? (
        <p role="alert" className="text-destructive text-xs">
          We couldn&apos;t search. Try again.
        </p>
      ) : people.length === 0 ? (
        <p className="text-foreground-secondary text-xs">
          Nobody in this cohort matches.
        </p>
      ) : (
        <ul className="grid gap-1">
          {people.map((person) => {
            const name = person.displayName ?? person.email;
            return (
              <li
                key={person.id}
                className="flex min-h-9 items-center justify-between gap-2 text-sm"
              >
                <span className="grid min-w-0">
                  <span className="truncate">{name}</span>
                  {person.displayName ? (
                    <span className="text-foreground-secondary truncate text-xs">
                      {person.email}
                    </span>
                  ) : null}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  aria-label={`Add ${name} to the list`}
                  onClick={() => onPick(person.id)}
                >
                  Add
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
