"use client";

import { cn } from "cn";
import Link from "next/link";

import { Button, buttonVariants } from "@/shared/ui/button";

// Next 16.2.6's TS plugin exempts only `reset` here, so it flags
// `unstable_retry`; renaming it would break the prop Next actually passes.
export default function CampusError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="grid h-dvh content-center justify-items-center gap-6 px-6 text-center">
      <div role="alert" className="grid max-w-md gap-2">
        <h1 className="font-display text-2xl font-bold">
          Something went wrong
        </h1>
        <p className="text-foreground-secondary">
          Campus hit an unexpected problem. Try again, or go back to your
          campuses.
        </p>
        {error.digest ? (
          <p className="text-foreground-muted text-xs">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
      <div className="flex gap-3">
        <Button size="lg" onClick={unstable_retry}>
          Try again
        </Button>
        <Link
          href="/campus"
          className={cn(buttonVariants({ size: "lg", variant: "ghost" }))}
        >
          Back to campuses
        </Link>
      </div>
    </main>
  );
}
