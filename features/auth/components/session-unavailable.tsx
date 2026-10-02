import { cn } from "cn";

import { buttonVariants } from "@/shared/ui/button";

// A plain anchor, not next/link: the retry must be a full request so the
// layout's session check runs again too.
export function SessionUnavailable({ retryHref }: { retryHref: string }) {
  return (
    <main className="grid h-dvh content-center justify-items-center gap-6 px-6 text-center">
      <div role="alert" className="grid max-w-md gap-2">
        <h1 className="font-display text-2xl font-bold">
          We couldn&apos;t check your session
        </h1>
        <p className="text-foreground-secondary">
          Campus can&apos;t reach the session service right now. Nothing has
          changed on your account.
        </p>
      </div>
      <a href={retryHref} className={cn(buttonVariants({ size: "lg" }))}>
        Try again
      </a>
    </main>
  );
}
