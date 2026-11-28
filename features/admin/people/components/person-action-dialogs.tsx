"use client";

import { type FormEvent, type ReactNode, useId, useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/shared/ui/field";
import { Textarea } from "@/shared/ui/textarea";

import {
  useReinstatePerson,
  useSetSystemRole,
  useSuspendPerson,
} from "../hooks/use-person-actions";
import {
  parseSuspendForm,
  SUSPEND_REASON_MAX_LENGTH,
} from "../schemas/suspend.schema";
import type {
  AssignableSystemRole,
  PersonReinstateProblem,
  PersonRoleProblem,
  PersonSuspendProblem,
} from "../types/people.types";

type Messages<TProblem extends string> = Readonly<
  Record<TProblem, string | undefined>
>;

const INVALID =
  "campus-api rejected this request. Refresh the page and try again.";
const MISSING = "This account no longer exists. Refresh the page.";

const ROLE_PROBLEMS: Messages<PersonRoleProblem> = {
  invalid: INVALID,
  "signed-out": undefined,
  forbidden: "You no longer have permission to change roles.",
  missing: MISSING,
  protected: "A super admin's role, and your own, can't be changed here.",
  unavailable:
    "We couldn't change this role. Nothing was changed. Check your connection and try again.",
};

const SUSPEND_PROBLEMS: Messages<PersonSuspendProblem> = {
  invalid: "campus-api rejected this request. Check the reason and try again.",
  "signed-out": undefined,
  forbidden:
    "You don't have permission to suspend this account. Only a super admin can suspend another super admin.",
  missing: MISSING,
  "already-suspended": "This account is already suspended. Refresh the page.",
  unavailable:
    "We couldn't suspend this account. Nothing was changed. Check your connection and try again.",
};

const REINSTATE_PROBLEMS: Messages<PersonReinstateProblem> = {
  invalid: INVALID,
  "signed-out": undefined,
  forbidden:
    "You don't have permission to reinstate this account. Only a super admin can lift a suspension a super admin made.",
  missing: MISSING,
  "not-suspended": "This account isn't suspended any more. Refresh the page.",
  unavailable:
    "We couldn't reinstate this account. Nothing was changed. Check your connection and try again.",
};

interface ActionDialogProps {
  userId: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ConfirmDialog({
  open,
  onOpenChange,
  isPending,
  reset,
  title,
  description,
  problem,
  confirm,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  reset: () => void;
  title: string;
  description: ReactNode;
  problem: string | undefined;
  confirm: ReactNode;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  children?: ReactNode;
}) {
  function changeOpen(next: boolean) {
    // A request in flight finishes before the dialog can close, so its
    // outcome is never lost.
    if (!next && isPending) return;
    if (!next) reset();
    onOpenChange(next);
  }

  const body = (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {children}
      {problem ? (
        <p role="alert" className="text-destructive text-sm">
          {problem}
        </p>
      ) : null}
      <DialogFooter>
        <DialogClose disabled={isPending} render={<Button variant="outline" />}>
          Cancel
        </DialogClose>
        {confirm}
      </DialogFooter>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent showCloseButton={false}>
        {onSubmit ? (
          <form noValidate onSubmit={onSubmit} className="grid gap-4">
            {body}
          </form>
        ) : (
          body
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SystemRoleDialog({
  userId,
  name,
  systemRole,
  open,
  onOpenChange,
}: ActionDialogProps & { systemRole: AssignableSystemRole }) {
  const role = useSetSystemRole({
    userId,
    name,
    systemRole,
    onDone: () => onOpenChange(false),
  });
  const granting = systemRole === "admin";

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      isPending={role.isPending}
      reset={role.reset}
      title={
        granting ? `Promote ${name} to admin?` : `Demote ${name} from admin?`
      }
      description={
        granting
          ? "They get full administration of Campus, every cohort included."
          : "They lose administration of Campus and are signed out on every device."
      }
      problem={role.problem && ROLE_PROBLEMS[role.problem]}
      confirm={
        <Button
          type="button"
          variant={granting ? "default" : "destructive"}
          disabled={role.isPending}
          onClick={role.change}
        >
          {role.isPending
            ? "Saving…"
            : granting
              ? "Promote to admin"
              : "Demote from admin"}
        </Button>
      }
    />
  );
}

export function SuspendDialog({
  userId,
  name,
  open,
  onOpenChange,
}: ActionDialogProps) {
  const reasonId = useId();
  const [reasonError, setReasonError] = useState<string>();
  const suspension = useSuspendPerson({
    userId,
    name,
    onDone: () => onOpenChange(false),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = parseSuspendForm(new FormData(event.currentTarget));
    if (read.kind === "invalid") {
      setReasonError(read.error);
      return;
    }
    setReasonError(undefined);
    suspension.suspend(read.request);
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReasonError(undefined);
        onOpenChange(next);
      }}
      isPending={suspension.isPending}
      reset={suspension.reset}
      title={`Suspend ${name}?`}
      description="They are signed out everywhere and can't sign in until an admin reinstates them. Their cohorts and role stay as they are."
      problem={suspension.problem && SUSPEND_PROBLEMS[suspension.problem]}
      onSubmit={submit}
      confirm={
        <Button
          type="submit"
          variant="destructive"
          disabled={suspension.isPending}
        >
          {suspension.isPending ? "Suspending…" : "Suspend"}
        </Button>
      }
    >
      <Field data-invalid={reasonError ? true : undefined}>
        <FieldLabel htmlFor={reasonId}>Reason (optional)</FieldLabel>
        <Textarea
          id={reasonId}
          name="reason"
          maxLength={SUSPEND_REASON_MAX_LENGTH}
          disabled={suspension.isPending}
          aria-invalid={reasonError ? true : undefined}
        />
        {reasonError ? (
          <FieldError>{reasonError}</FieldError>
        ) : (
          <FieldDescription>
            Kept in the audit log only. It isn&apos;t shown on their account.
          </FieldDescription>
        )}
      </Field>
    </ConfirmDialog>
  );
}

export function ReinstateDialog({
  userId,
  name,
  open,
  onOpenChange,
}: ActionDialogProps) {
  const reinstatement = useReinstatePerson({
    userId,
    name,
    onDone: () => onOpenChange(false),
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      isPending={reinstatement.isPending}
      reset={reinstatement.reset}
      title={`Reinstate ${name}?`}
      description="They can sign in again. Sessions from before the suspension stay ended, so they sign in afresh."
      problem={
        reinstatement.problem && REINSTATE_PROBLEMS[reinstatement.problem]
      }
      confirm={
        <Button
          type="button"
          disabled={reinstatement.isPending}
          onClick={reinstatement.reinstate}
        >
          {reinstatement.isPending ? "Reinstating…" : "Reinstate"}
        </Button>
      }
    />
  );
}
