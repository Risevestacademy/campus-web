"use client";

import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/ssr/PaperPlaneTilt";
import { UserPlusIcon } from "@phosphor-icons/react/dist/ssr/UserPlus";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import { type FormEvent, type ReactNode, useId, useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";

import { useSendInvites } from "../hooks/use-send-invites";
import {
  buildInviteRequests,
  fieldRulesFor,
  INVITE_ROLE_LABELS,
  INVITE_ROLES,
  type InviteFormErrors,
  validateInviteForm,
} from "../invite-form";
import type {
  InviteCreateProblem,
  InviteFailure,
  InviteOptions,
  InviteRole,
} from "../types/invite.types";
import { EmailTokenField } from "./email-token-field";

const SELECT_CLASS_NAME =
  "border-input bg-background h-11 w-full appearance-none rounded-xl border px-3 pr-9 text-sm focus-visible:border-[#3155D6] dark:border-[#2B3B5F] dark:focus-visible:border-[#3155D6] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-transparent";

const FAILURE_MESSAGES: Record<InviteCreateProblem, string | undefined> = {
  conflict: "Already has a pending invite, or is already in this cohort.",
  invalid: "campus-api rejected this invite. Check the role, track and group.",
  "signed-out": undefined,
  forbidden: "You no longer have permission to send invites.",
  missing: "The cohort, track or group no longer exists. Refresh the page.",
  "rate-limited": "Too many invites at once. Wait a moment and try again.",
  unavailable: "We couldn't send this. Check your connection and try again.",
};

const REASSURANCES = [
  "No extra setup after they sign up: what you choose here is already attached.",
  "Each link works once and expires. You can resend it from the list.",
  "They'll sign in with Google after registering.",
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid content-start gap-2 text-sm font-medium">
      {label}
      <span className="relative grid">
        {children}
        <CaretDownIcon
          aria-hidden
          className="text-foreground-secondary pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
        />
      </span>
      {hint ? (
        <span className="text-foreground-secondary text-xs font-normal">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function InvitePeopleDialog({
  cohortId,
  options,
}: {
  cohortId: string;
  options: InviteOptions;
}) {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [role, setRole] = useState<InviteRole>("student");
  const [trackId, setTrackId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [errors, setErrors] = useState<InviteFormErrors>({});
  const [failures, setFailures] = useState<InviteFailure[]>([]);
  const errorsId = useId();

  const { send, isPending, reset } = useSendInvites({
    onDone: (failed) => {
      setFailures(failed);
      if (failed.length === 0) {
        setEmails([]);
        setOpen(false);
      } else {
        // Only what did not go stays, so a second send does not repeat the rest.
        setEmails(failed.map(({ email }) => email));
      }
    },
  });

  const rules = fieldRulesFor(role);
  const tracks = options.tracks.kind === "loaded" ? options.tracks.options : [];
  const groups = options.groups.kind === "loaded" ? options.groups.options : [];
  const count = emails.length;

  function changeOpen(next: boolean) {
    if (!next && isPending) return;
    if (next) {
      reset();
      setErrors({});
      setFailures([]);
    }
    setOpen(next);
  }

  function changeRole(next: InviteRole) {
    const nextRules = fieldRulesFor(next);
    setRole(next);
    if (nextRules.track === "off") setTrackId("");
    if (nextRules.group === "off") setGroupId("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = { emails, role, trackId, groupId };
    const invalid = validateInviteForm(values);
    setErrors(invalid ?? {});
    setFailures([]);
    if (!invalid) send(buildInviteRequests(cohortId, values));
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button />}>
        <UserPlusIcon aria-hidden />
        Invite people
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="bg-background top-3 right-3 left-auto h-[calc(100dvh-1.5rem)] max-w-none translate-x-0 translate-y-0 grid-rows-[1fr] gap-0 overflow-y-auto rounded-3xl border border-[#D6E3EC] p-0 shadow-2xl ring-0 sm:max-w-xl dark:border-[#2B3B5F] dark:bg-[#1F2940]"
      >
        <form noValidate onSubmit={submit} className="flex flex-col">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#D6E3EC] px-6 py-5 dark:border-[#2B3B5F]">
            <div className="grid gap-1">
              <DialogTitle className="font-display text-3xl font-semibold">
                Invite people
              </DialogTitle>
              <DialogDescription className="text-foreground-secondary">
                They&apos;ll get an email with a one-time link.
              </DialogDescription>
            </div>
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hover:bg-error-500 hover:text-error-50 dark:hover:bg-error-500 dark:hover:text-error-50 size-9 rounded-full bg-[#E6F2F7] dark:bg-[#2B3B5F]"
                />
              }
            >
              <XIcon aria-hidden />
              <span className="sr-only">Close</span>
            </DialogClose>
          </header>

          <div className="grid flex-1 content-start gap-5 p-6">
            <div className="grid gap-2">
              <span className="text-sm font-medium">Emails</span>
              <EmailTokenField
                emails={emails}
                onChange={setEmails}
                invalid={Boolean(errors.emails)}
                describedBy={errors.emails ? errorsId : undefined}
              />
              <span className="text-foreground-secondary text-xs">
                Paste several at once, separated by commas, spaces or new lines.
                Everyone gets the same placement.
              </span>
            </div>

            <Field label="Role">
              <select
                value={role}
                onChange={(event) =>
                  changeRole(event.target.value as InviteRole)
                }
                className={SELECT_CLASS_NAME}
              >
                {INVITE_ROLES.map((choice) => (
                  <option key={choice} value={choice}>
                    {INVITE_ROLE_LABELS[choice]}
                  </option>
                ))}
              </select>
            </Field>

            {rules.track !== "off" || rules.group !== "off" ? (
              <div className="grid items-start gap-4 sm:grid-cols-2">
                {rules.track !== "off" ? (
                  <Field
                    label="Track"
                    hint={
                      options.tracks.kind === "unavailable"
                        ? "We couldn't load the tracks."
                        : undefined
                    }
                  >
                    <select
                      value={trackId}
                      disabled={tracks.length === 0}
                      aria-invalid={Boolean(errors.track)}
                      onChange={(event) => setTrackId(event.target.value)}
                      className={SELECT_CLASS_NAME}
                    >
                      <option value="">
                        {rules.track === "required"
                          ? "Choose a track"
                          : "No track"}
                      </option>
                      {tracks.map((track) => (
                        <option key={track.id} value={track.id}>
                          {track.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}
                {rules.group !== "off" ? (
                  <Field
                    label="Mentorship group"
                    hint={
                      options.groups.kind === "unavailable"
                        ? "We couldn't load the groups."
                        : undefined
                    }
                  >
                    <select
                      value={groupId}
                      disabled={groups.length === 0}
                      onChange={(event) => setGroupId(event.target.value)}
                      className={SELECT_CLASS_NAME}
                    >
                      <option value="">No group</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.mentorName
                            ? `${group.name} · ${group.mentorName}`
                            : group.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}
              </div>
            ) : null}

            {role === "admin" ? (
              <p className="text-foreground-secondary text-sm">
                Admins are not placed in a cohort, so these invites do not
                appear in this cohort&apos;s list.
              </p>
            ) : null}

            {errors.emails || errors.track ? (
              <p
                id={errorsId}
                role="alert"
                className="text-destructive text-sm"
              >
                {errors.emails ?? errors.track}
              </p>
            ) : null}

            {failures.length > 0 ? (
              <ul role="alert" className="grid gap-1 text-sm">
                {failures.map(({ email, problem }) => (
                  <li key={email} className="text-destructive">
                    <span className="font-medium">{email}</span>:{" "}
                    {FAILURE_MESSAGES[problem]}
                  </li>
                ))}
              </ul>
            ) : null}

            <ul className="grid gap-2 rounded-2xl bg-[#E9ECF6] p-4 text-sm dark:bg-[#2B3B5F]">
              {REASSURANCES.map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <CheckIcon
                    aria-hidden
                    size={16}
                    className="text-success mt-0.5 shrink-0"
                  />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <footer className="flex items-center justify-end gap-3 border-t border-[#D6E3EC] p-6 dark:border-[#2B3B5F]">
            <DialogClose
              disabled={isPending}
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="hover:border-error-500 hover:bg-error-500 hover:text-error-50 dark:hover:border-error-500 dark:hover:bg-error-500 dark:hover:text-error-50 h-11 px-6 text-base dark:border-[#2B3B5F]"
                />
              }
            >
              Cancel
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="h-11 px-6 text-base"
            >
              <PaperPlaneTiltIcon aria-hidden />
              {isPending
                ? "Sending…"
                : count > 1
                  ? `Send ${count} invites`
                  : "Send invite"}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
