import { cn } from "cn";

import { buttonVariants } from "@/shared/ui/button";

interface SessionUnavailableProps {
  retryHref: string;
}

// A plain anchor, not next/link: the retry must be a full request so the
// layout's session check runs again too.
export function SessionUnavailableNotice({
  retryHref,
}: SessionUnavailableProps) {
  return (
    <div className="grid justify-items-center gap-6 text-center">
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
    </div>
  );
}

export function SessionUnavailable({ retryHref }: SessionUnavailableProps) {
  return (
    <main className="grid h-dvh content-center px-6">
      <SessionUnavailableNotice retryHref={retryHref} />
    </main>
  );
}
