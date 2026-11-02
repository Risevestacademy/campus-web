"use client";

import { ShieldCheckIcon } from "@phosphor-icons/react/dist/ssr/ShieldCheck";
import { cn } from "cn";

import { floatingControlClassName } from "@/shared/ui/floating-control";

import { useAnalyticsConsent } from "./use-analytics-consent";

// On every page above the theme toggle, so withdrawing is as easy as
// accepting. Below the banner's layer, which covers it while open.
export function PrivacyChoicesButton() {
  const { canReopen, isOpen, toggle } = useAnalyticsConsent();

  if (!canReopen) return null;

  return (
    <button
      type="button"
      aria-label="Privacy choices"
      title="Privacy choices"
      aria-expanded={isOpen}
      onClick={toggle}
      className={cn(floatingControlClassName, "bottom-16 z-30")}
    >
      <ShieldCheckIcon aria-hidden size={16} weight="regular" />
    </button>
  );
}
