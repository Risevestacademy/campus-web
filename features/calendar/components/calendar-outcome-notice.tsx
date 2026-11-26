"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";

import { useMountEffect } from "@/shared/lib/use-mount-effect";
import { toast } from "@/shared/ui/toast";

import {
  CALENDAR_OUTCOME_PARAMETER,
  type ConnectOutcome,
} from "../schemas/connect-outcome.schema";
import { noticeForOutcome } from "../services/connect-outcome-notice";

const CALENDAR_OUTCOME_TOAST_ID = "calendar-outcome";

// Says how connecting went, once, then takes `?calendar=` off the address so a
// reload or a shared link does not say it again. Renders nothing.
export function CalendarOutcomeNotice({
  outcome,
}: Readonly<{ outcome: ConnectOutcome }>) {
  const router = useRouter();
  const pathname = usePathname();

  useMountEffect(() => {
    // The toaster sits beside the page and subscribes once this effect has
    // run, and the toast manager keeps nothing for a toast added before then.
    // On a full page load, which is how Google returns the member, that would
    // lose it. So it is said a moment later, and not cancelled if this unmounts
    // first: taking the parameter off the address re-renders the page without
    // this component. One id, so Strict Mode's second mount says it only once.
    setTimeout(() => {
      const { message, tone } = noticeForOutcome(outcome);
      toast.add({ id: CALENDAR_OUTCOME_TOAST_ID, title: message, type: tone });

      const address = new URL(window.location.href);
      address.searchParams.delete(CALENDAR_OUTCOME_PARAMETER);
      const search = address.searchParams.toString();
      router.replace((search ? `${pathname}?${search}` : pathname) as Route, {
        scroll: false,
      });
    }, 0);
  });

  return null;
}
