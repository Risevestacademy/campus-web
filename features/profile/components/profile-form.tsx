"use client";

import { cn } from "cn";
import { type FormEvent, useId, useState } from "react";

import { avatarToneOf, initialOf } from "@/shared/lib/avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

import type { useSaveOwnProfile } from "../hooks/use-save-own-profile";
import { parseProfileEdit } from "../schemas/own-profile.schema";
import type {
  OwnProfile,
  ProfileFieldErrors,
  ProfileFieldValues,
  ProfileSaveProblem,
} from "../types";

const ROLE_LABELS = {
  student: "Student",
  professor: "Professor",
  mentor: "Mentor",
  guest: "Guest",
} as const;

const PROBLEM_MESSAGES: Record<ProfileSaveProblem, string | undefined> = {
  "signed-out": undefined,
  invalid:
    "Campus couldn't save these changes. A field may be too long; shorten it and try again.",
  unavailable:
    "We couldn't save your profile. Check your connection and try again.",
};

type FieldName = keyof ProfileFieldValues & string;

function hintId(id: string, field: FieldName) {
  return `${id}-${field}-hint`;
}

export function ProfileForm({
  cohortId,
  profile,
  saving,
}: {
  cohortId: string;
  profile: OwnProfile;
  saving: ReturnType<typeof useSaveOwnProfile>;
}) {
  const id = useId();
  const [errors, setErrors] = useState<ProfileFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [unchanged, setUnchanged] = useState(false);
  const place = profile.memberships.find(
    (membership) => membership.cohort.id === cohortId,
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = parseProfileEdit(profile, new FormData(event.currentTarget));
    setErrors(read.kind === "invalid" ? read.errors : {});
    setFormError(read.kind === "invalid" ? read.formError : undefined);
    setUnchanged(read.kind === "unchanged");
    if (read.kind === "valid") {
      saving.save(read.changes);
    } else {
      saving.reset();
    }
  }

  const alertMessage =
    formError ??
    (saving.problem ? PROBLEM_MESSAGES[saving.problem] : undefined);

  function textField(
    field: FieldName,
    label: string,
    options: {
      autoComplete: string;
      hint?: string;
      placeholder?: string;
      type?: string;
    },
  ) {
    const error = errors[field];
    const describedBy = [
      options.hint ? hintId(id, field) : undefined,
      error ? `${id}-${field}-error` : undefined,
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <Field data-invalid={Boolean(error)}>
        <FieldLabel htmlFor={`${id}-${field}`} className="gap-1.5">
          {label}
          {options.hint ? (
            <span
              id={hintId(id, field)}
              className="text-muted-foreground font-normal"
            >
              {options.hint}
            </span>
          ) : null}
        </FieldLabel>
        <Input
          id={`${id}-${field}`}
          name={field}
          type={options.type}
          defaultValue={profile[field] ?? ""}
          placeholder={options.placeholder}
          autoComplete={options.autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          className="h-11 rounded-xl px-3.5"
        />
        {error ? (
          <FieldError id={`${id}-${field}-error`}>{error}</FieldError>
        ) : null}
      </Field>
    );
  }

  return (
    <form noValidate onSubmit={submit} className="flex h-full flex-col gap-5">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          {profile.avatarUrl ? (
            <AvatarImage src={profile.avatarUrl} alt="" />
          ) : null}
          <AvatarFallback
            className={cn(
              "text-2xl font-semibold",
              avatarToneOf(profile.id, "lemon"),
            )}
          >
            {initialOf(profile.displayName)}
          </AvatarFallback>
        </Avatar>
        <p className="text-muted-foreground text-sm">
          {profile.avatarUrl
            ? "Your photo comes from your Google account."
            : "Your initial shows on your avatar across Campus."}
        </p>
      </div>

      {alertMessage ? (
        <p role="alert" className="text-destructive text-sm">
          {alertMessage}
        </p>
      ) : null}
      {unchanged ? (
        <p role="alert" className="text-sm">
          Change at least one field before saving.
        </p>
      ) : null}

      <FieldGroup className="gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {textField("firstName", "First name", { autoComplete: "given-name" })}
          {textField("lastName", "Last name", { autoComplete: "family-name" })}
        </div>
        {textField("displayName", "Display name", {
          autoComplete: "nickname",
          hint: "on the map, in lists and on calls",
        })}
        <Field data-invalid={Boolean(errors.bio)}>
          <FieldLabel htmlFor={`${id}-bio`} className="gap-1.5">
            Bio
            <span
              id={hintId(id, "bio")}
              className="text-muted-foreground font-normal"
            >
              shown on your profile card
            </span>
          </FieldLabel>
          <Textarea
            id={`${id}-bio`}
            name="bio"
            rows={3}
            defaultValue={profile.bio ?? ""}
            placeholder="What you're working on, or what people can ask you about"
            aria-invalid={Boolean(errors.bio)}
            aria-describedby={hintId(id, "bio")}
            className="resize-none rounded-xl px-3.5 py-3"
          />
          {errors.bio ? <FieldError>{errors.bio}</FieldError> : null}
        </Field>
        {textField("phone", "Phone", {
          autoComplete: "tel",
          hint: "only admins see this",
          placeholder: "Add a phone number",
          type: "tel",
        })}
      </FieldGroup>

      {place ? (
        <dl className="grid gap-2.5 sm:grid-cols-3">
          {[
            ["Cohort", place.cohort.name],
            ["Track", place.track?.name ?? "None"],
            ["Role", ROLE_LABELS[place.role]],
          ].map(([term, detail]) => (
            <div
              key={term}
              className="bg-surface-elevated rounded-xl px-3.5 py-2.5"
            >
              <dt className="text-muted-foreground text-xs">{term}</dt>
              <dd className="mt-0.5 text-sm font-semibold">{detail}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {place ? "Cohort, track and role are set by your admin." : null}
        </p>
        <Button type="submit" size="lg" disabled={saving.isPending}>
          {saving.isPending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
