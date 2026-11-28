"use client";

import { type FormEvent, useId, useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";

import { useFlagInvite } from "../hooks/use-flag-invite";
import {
  FLAG_MESSAGE_MAX_LENGTH,
  parseFlagMessage,
} from "../schemas/invite-flag.schema";
import type { ExplainedInviteProblem } from "../types/invite.types";

const SEND_FAILURE =
  "We couldn't send your message. Check your connection and try again.";

export function FlagInviteDialog({
  inviteId,
  flagged,
  onFlagged,
  onSettled,
}: {
  inviteId: string;
  flagged: boolean;
  onFlagged: () => void;
  onSettled: (problem: ExplainedInviteProblem) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const flag = useFlagInvite({
    inviteId,
    onFlagged: () => {
      setOpen(false);
      onFlagged();
    },
    onSettled: (problem) => {
      setOpen(false);
      onSettled(problem);
    },
  });

  function changeOpen(next: boolean) {
    if (!next && flag.isPending) return;
    if (!next) {
      setError(undefined);
      flag.reset();
    }
    setOpen(next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = parseFlagMessage(new FormData(event.currentTarget));
    setError(read.kind === "invalid" ? read.error : undefined);
    if (read.kind === "valid") flag.send(read.message);
  }

  if (flagged) {
    return (
      <Button size="lg" variant="outline" disabled>
        Issue flagged
      </Button>
    );
  }

  const alert = error ?? (flag.failed ? SEND_FAILURE : undefined);

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button size="lg" variant="outline" />}>
        Flag an Issue
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <form noValidate onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Flag an issue with your invitation</DialogTitle>
            <DialogDescription>
              Your Campus admin gets your message by email. Your invitation
              stays open, so you can still go to Campus.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-message`}>What&apos;s wrong?</Label>
            <Textarea
              id={`${id}-message`}
              name="message"
              maxLength={FLAG_MESSAGE_MAX_LENGTH}
              placeholder="For example: I applied for the Product Design track, not Backend Engineering."
              aria-invalid={error ? true : undefined}
              aria-describedby={alert ? `${id}-alert` : undefined}
              className="min-h-28"
            />
          </div>
          {alert ? (
            <p id={`${id}-alert`} role="alert" className="text-destructive">
              {alert}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose
              disabled={flag.isPending}
              render={<Button type="button" variant="outline" />}
            >
              Cancel
            </DialogClose>
            <Button type="submit" disabled={flag.isPending}>
              {flag.isPending ? "Sending…" : "Send to admin"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
