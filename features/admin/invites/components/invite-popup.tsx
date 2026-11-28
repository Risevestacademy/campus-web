"use client";

import type { FormEvent, ReactNode } from "react";

import { Button } from "@/shared/ui/button";
import { DialogTrigger } from "@/shared/ui/dialog";

import {
  AdminSheet,
  AdminSheetCancel,
  SHEET_ACTION_CLASS_NAME,
} from "../../admin-sheet";

// Both invite popups: the administration sheet, opened by a button of its own.
export function InvitePopup({
  triggerIcon,
  triggerLabel,
  triggerVariant = "default",
  ...sheet
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerIcon: ReactNode;
  triggerLabel: string;
  triggerVariant?: "default" | "outline";
  title: string;
  description: ReactNode;
  footer: ReactNode;
  // Set when the body is a form, so Enter and the submit button send it.
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <AdminSheet
      {...sheet}
      trigger={
        <DialogTrigger
          render={
            <Button
              variant={triggerVariant === "outline" ? "outline" : "default"}
            />
          }
        >
          {triggerIcon}
          {triggerLabel}
        </DialogTrigger>
      }
    />
  );
}

export function InvitePopupCancel({ disabled }: { disabled?: boolean }) {
  return <AdminSheetCancel disabled={disabled} />;
}

export const POPUP_ACTION_CLASS_NAME = SHEET_ACTION_CLASS_NAME;
