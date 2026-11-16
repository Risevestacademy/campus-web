"use client";

import type { ComponentType, ReactNode } from "react";

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

// Routes pass auth's LogOutAction in; the shell draws the controls.
export type LogOutActionComponent = ComponentType<{
  children: (action: { logOut: () => void; isPending: boolean }) => ReactNode;
}>;

// Logging out ends the session everywhere, so the account menu and Settings
// ask first.
// The prompt closes on confirming: success leaves the page, and a failure
// explains itself in a toast that the open prompt would cover.
export function LogOutConfirmDialog({
  open,
  onOpenChange,
  logOut,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logOut: () => void;
  isPending: boolean;
}) {
  function confirm() {
    if (!open || isPending) return;
    onOpenChange(false);
    logOut();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Log out of Campus?</DialogTitle>
          <DialogDescription>
            You will leave your room and need to sign in again to come back.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <DialogClose render={<Button variant="outline" />}>
            Stay signed in
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={!open || isPending}
            onClick={confirm}
          >
            Log out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
