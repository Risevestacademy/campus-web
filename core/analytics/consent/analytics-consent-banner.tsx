"use client";

import { type Ref, useId } from "react";

import { Button } from "@/shared/ui/button";

import { useAnalyticsConsent } from "./use-analytics-consent";

export function AnalyticsConsentBanner() {
  const { isOpen, isReviewing, accept, reject } = useAnalyticsConsent();

  if (!isOpen) return null;

  return (
    <AnalyticsConsentNotice
      ref={isReviewing ? focusElement : undefined}
      onAccept={accept}
      onReject={reject}
    />
  );
}

function focusElement(element: HTMLElement | null): void {
  element?.focus();
}

type AnalyticsConsentNoticeProps = Readonly<{
  ref?: Ref<HTMLElement>;
  onAccept: () => void;
  onReject: () => void;
}>;

export function AnalyticsConsentNotice({
  ref,
  onAccept,
  onReject,
}: AnalyticsConsentNoticeProps) {
  const headingId = useId();

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-labelledby={headingId}
      className="bg-surface border-border text-foreground focus-visible:ring-border-focus fixed inset-x-4 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 grid gap-3 rounded-2xl border p-4 shadow-lg transition-opacity duration-200 outline-none focus-visible:ring-2 motion-reduce:transition-none sm:right-auto sm:bottom-3 sm:left-16 sm:w-full sm:max-w-sm starting:opacity-0"
    >
      <h2 id={headingId} className="font-semibold text-balance">
        Analytics cookies
      </h2>
      <p className="text-foreground-secondary text-sm text-pretty">
        Campus uses PostHog to learn which pages and features people use. If you
        accept, it stores a cookie for a year and links your activity to your
        Campus account ID, role and cohort. Never your name or email. You can
        change this any time under Privacy choices.
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
