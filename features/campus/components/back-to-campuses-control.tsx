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
        "bg-error text-primary-foreground hover:bg-error-600 hover:text-primary-foreground hover:ring-error hover:ring-offset-background hover:ring hover:ring-offset-1 [&_svg:not([class*='size-'])]:size-5",
      )}
    >
      <ArrowBendUpRightIcon aria-hidden />
    </Link>
  );
}
