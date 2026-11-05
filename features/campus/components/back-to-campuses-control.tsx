import { ArrowBendUpRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowBendUpRight";
import { cn } from "cn";
import Link from "next/link";

import { buttonVariants } from "@/shared/ui/button";

// Leaving the cohort route ends the Presence Session.
export function BackToCampusesControl() {
  return (
    <Link
      href="/campus"
      aria-label="Back to campuses"
      title="Back to campuses"
      className={cn(
        buttonVariants({ size: "icon", variant: "ghost" }),
        "bg-surface text-error-icon hover:bg-error/10 hover:text-error-icon hover:ring-error-icon hover:ring-offset-background hover:ring hover:ring-offset-1 [&_svg:not([class*='size-'])]:size-5",
      )}
    >
      <ArrowBendUpRightIcon aria-hidden />
    </Link>
  );
}
