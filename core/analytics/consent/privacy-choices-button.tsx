"use client";

import { openAnalyticsConsentChoices } from "./consent-store";

export function PrivacyChoicesButton({
  className,
}: Readonly<{ className?: string }>) {
  return (
    <button
      type="button"
      className={className}
      onClick={openAnalyticsConsentChoices}
    >
      Privacy choices
    </button>
  );
}
