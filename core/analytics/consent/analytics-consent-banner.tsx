"use client";

import { type KeyboardEvent, type Ref, useId } from "react";

import { Button } from "@/shared/ui/button";

import { useAnalyticsConsent } from "./use-analytics-consent";

export function AnalyticsConsentBanner() {
  const { isOpen, isReviewing, accept, reject, close } = useAnalyticsConsent();

  if (!isOpen) return null;

  return (
    <AnalyticsConsentNotice
      ref={isReviewing ? focusForReview : followKeyboardEntry}
      onAccept={accept}
      onReject={reject}
      onEscape={close}
    />
  );
}

// Reopened from Privacy choices: focus moves in and goes back to the opener.
function focusForReview(section: HTMLElement): () => void {
  const opener = document.activeElement;
  section.focus();
  return returnFocusOnClose(section, opener);
}

// First visit: focus stays put, unless a keyboard user tabs in.
function followKeyboardEntry(section: HTMLElement): () => void {
  return returnFocusOnClose(section, null);
}

// Closing unmounts the focused button, which would drop focus to <body>.
function returnFocusOnClose(
  section: HTMLElement,
  initial: Element | null,
): () => void {
  let returnTo = initial;
  const rememberEntry = ({ relatedTarget }: FocusEvent) => {
    if (relatedTarget instanceof Element && !section.contains(relatedTarget)) {
      returnTo = relatedTarget;
    }
  };
  section.addEventListener("focusin", rememberEntry);

  return () => {
    section.removeEventListener("focusin", rememberEntry);
    if (returnTo instanceof HTMLElement && isFocusLost(section)) {
      returnTo.focus();
    }
  };
}

function isFocusLost(section: HTMLElement): boolean {
  const active = document.activeElement;
  return !active || active === document.body || section.contains(active);
}

type AnalyticsConsentNoticeProps = Readonly<{
  ref?: Ref<HTMLElement>;
  onAccept: () => void;
  onReject: () => void;
  onEscape: () => void;
}>;

export function AnalyticsConsentNotice({
  ref,
  onAccept,
  onReject,
  onEscape,
}: AnalyticsConsentNoticeProps) {
  const headingId = useId();

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") onEscape();
  };

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-labelledby={headingId}
      onKeyDown={handleKeyDown}
      className="bg-surface border-border text-foreground focus-visible:ring-border-focus fixed inset-x-4 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 grid gap-3 rounded-2xl border p-4 shadow-lg transition-opacity duration-200 outline-none focus-visible:ring-2 motion-reduce:transition-none sm:right-auto sm:bottom-3 sm:left-16 sm:w-full sm:max-w-sm starting:opacity-0"
    >
      <h2 id={headingId} className="font-semibold text-balance">
        Analytics cookies
      </h2>
      <p className="text-foreground-secondary text-sm text-pretty">
        Campus uses PostHog to learn which pages and features people use. If you
        accept, this browser stores a cookie for a year and links activity to
        the signed-in Campus account ID, role and cohort. Never a name or email.
        The choice applies to everyone using this browser. You can change it any
        time under Privacy choices.
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onReject}
        >
          Reject
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onAccept}
        >
          Accept
        </Button>
      </div>
    </section>
  );
}
