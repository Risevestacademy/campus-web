"use client";

import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import type { FormEvent, ReactNode } from "react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";

// The look both invite popups share: a card inset from the edge, a header with
// a round close button, a body, and a footer of actions. It takes the dark look
// of the feedback popup.
export function InvitePopup({
  open,
  onOpenChange,
  triggerIcon,
  triggerLabel,
  triggerVariant = "default",
  title,
  description,
  footer,
  onSubmit,
  children,
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
  const sections = (
    <>
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#D6E3EC] px-6 py-5 dark:border-[#2B3B5F]">
        <div className="grid gap-1">
          <DialogTitle className="font-display text-3xl font-semibold">
            {title}
          </DialogTitle>
          <DialogDescription className="text-foreground-secondary">
            {description}
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

      <div className="grid flex-1 content-start gap-5 p-6">{children}</div>

      <footer className="flex items-center justify-end gap-3 border-t border-[#D6E3EC] p-6 dark:border-[#2B3B5F]">
        {footer}
      </footer>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
      <DialogContent
        showCloseButton={false}
        className="bg-background top-3 right-3 left-auto h-[calc(100dvh-1.5rem)] max-w-none translate-x-0 translate-y-0 grid-rows-[1fr] gap-0 overflow-y-auto rounded-3xl border border-[#D6E3EC] p-0 shadow-2xl ring-0 sm:max-w-xl dark:border-[#2B3B5F] dark:bg-[#1F2940]"
      >
        {onSubmit ? (
          <form noValidate onSubmit={onSubmit} className="flex flex-col">
            {sections}
          </form>
        ) : (
          <div className="flex flex-col">{sections}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Closes the popup. The same look as Cancel in the feedback popup.
export function InvitePopupCancel({ disabled }: { disabled?: boolean }) {
  return (
    <DialogClose
      disabled={disabled}
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
  );
}

export const POPUP_ACTION_CLASS_NAME = "h-11 px-6 text-base";
