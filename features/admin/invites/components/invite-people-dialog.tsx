"use client";

import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/ssr/PaperPlaneTilt";
import { UserPlusIcon } from "@phosphor-icons/react/dist/ssr/UserPlus";
import { type FormEvent, type ReactNode, useId, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/shared/ui/field";

import { useSendInvites } from "../hooks/use-send-invites";
import {
  buildInviteRequests,
  fieldRulesFor,
  INVITE_ROLES,
  type InviteFormErrors,
  inviteRoleLabel,
  parseInviteRole,
  readInviteForm,
} from "../invite-form";
import { plural } from "../invite-format";
import type {
  InviteCreateProblem,
  InviteFailure,
  InviteOptions,
  InviteRole,
} from "../types/invite.types";
import { EmailTokenField } from "./email-token-field";
import {
  InvitePopup,
  InvitePopupCancel,
  POPUP_ACTION_CLASS_NAME,
} from "./invite-popup";

const SELECT_CLASS_NAME =
  "border-input bg-background h-11 w-full appearance-none rounded-xl border px-3 pr-9 text-sm focus-visible:border-[#3155D6] dark:border-[#2B3B5F] dark:focus-visible:border-[#3155D6] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-transparent";

const FAILURE_MESSAGES: Record<InviteCreateProblem, string> = {
  conflict: "Already has a pending invite, or is already in this cohort.",
  invalid: "campus-api rejected this invite. Check the role, track and group.",
  "signed-out": "Your session ended. Sign in again, then send the rest.",
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

// A labelled select with its arrow. The hint sits outside the label, so it
// does not become part of the select's name.
function SelectField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();

  return (
    <Field className="content-start">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <span className="relative grid">
        {children(id)}
        <CaretDownIcon
          aria-hidden
          className="text-foreground-secondary pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
        />
      </span>
      {hint ? (
        <FieldDescription className="text-foreground-secondary text-xs">
          {hint}
        </FieldDescription>
      ) : null}
    </Field>
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
    const read = readInviteForm(new FormData(event.currentTarget));
    setFailures([]);

    if (read.kind === "invalid") {
      setErrors(read.errors);
      return;
    }
    setErrors({});
    send(buildInviteRequests(cohortId, read.data));
  }

  return (
    <InvitePopup
      open={open}
      onOpenChange={changeOpen}
      triggerIcon={<UserPlusIcon aria-hidden />}
      triggerLabel="Invite people"
      title="Invite people"
      description="They'll get an email with a one-time link."
      onSubmit={submit}
      footer={
        <>
          <InvitePopupCancel disabled={isPending} />
          <Button
            type="submit"
            size="sm"
            disabled={isPending}
            className={POPUP_ACTION_CLASS_NAME}
          >
            <PaperPlaneTiltIcon aria-hidden />
            {isPending
              ? "Sending…"
              : count > 1
                ? `Send ${plural(count, "invite")}`
                : "Send invite"}
          </Button>
        </>
      }
    >
      <div className="grid gap-2">
        <span className="text-sm font-medium">Emails</span>
        <EmailTokenField
          emails={emails}
          onChange={setEmails}
          invalid={Boolean(errors.emails)}
          describedBy={errors.emails ? errorsId : undefined}
        />
        <input type="hidden" name="emails" value={emails.join(" ")} />
        <span className="text-foreground-secondary text-xs">
          Paste several at once, separated by commas, spaces or new lines.
          Everyone gets the same placement.
        </span>
      </div>

      <SelectField label="Role">
        {(id) => (
          <select
            id={id}
            name="role"
            value={role}
            onChange={(event) => {
              const next = parseInviteRole(event.target.value);
              if (next) changeRole(next);
            }}
            className={SELECT_CLASS_NAME}
          >
            {INVITE_ROLES.map((choice) => (
              <option key={choice} value={choice}>
                {inviteRoleLabel(choice)}
              </option>
            ))}
          </select>
        )}
      </SelectField>

      {rules.track !== "off" || rules.group !== "off" ? (
        <div className="grid items-start gap-4 sm:grid-cols-2">
          {rules.track !== "off" ? (
            <SelectField
              label="Track"
              hint={
                options.tracks.kind === "unavailable"
                  ? "We couldn't load the tracks."
                  : undefined
              }
            >
              {(id) => (
                <select
                  id={id}
                  name="track"
                  value={trackId}
                  disabled={tracks.length === 0}
                  aria-invalid={Boolean(errors.track)}
                  onChange={(event) => setTrackId(event.target.value)}
                  className={SELECT_CLASS_NAME}
                >
                  <option value="">
                    {rules.track === "required" ? "Choose a track" : "No track"}
                  </option>
                  {tracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.name}
                    </option>
                  ))}
                </select>
              )}
            </SelectField>
          ) : null}
          {rules.group !== "off" ? (
            <SelectField
              label="Mentorship group"
              hint={
                options.groups.kind === "unavailable"
                  ? "We couldn't load the groups."
                  : undefined
              }
            >
              {(id) => (
                <select
                  id={id}
                  name="group"
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
              )}
            </SelectField>
          ) : null}
        </div>
      ) : null}

      {role === "admin" ? (
        <p className="text-foreground-secondary text-sm">
          Admins are not placed in a cohort, so these invites do not appear in
          this cohort&apos;s list.
        </p>
      ) : null}

      {errors.emails || errors.track ? (
        <p id={errorsId} role="alert" className="text-destructive text-sm">
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
    </InvitePopup>
  );
}
