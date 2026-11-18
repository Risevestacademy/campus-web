import Link from "next/link";

import { buttonVariants } from "@/shared/ui/button";

const MESSAGES = {
  unusable: {
    title: "This link doesn't work",
    body: "It may have been replaced or switched off, or it may be for a cohort you aren't in. Ask whoever sent it for a new one.",
  },
  unavailable: {
    title: "We couldn't open this link",
    body: "Campus could not reach the sign-in service. Try again in a moment.",
  },
} as const;

export function RoomLinkNotice({
  kind,
  retryHref,
}: {
  kind: keyof typeof MESSAGES;
  retryHref: string;
}) {
  const { body, title } = MESSAGES[kind];

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-10">
      <div role="alert" className="grid max-w-96 justify-items-center gap-4">
        <h1 className="font-display text-center text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground text-center text-pretty">{body}</p>
        {kind === "unavailable" ? (
          <a href={retryHref} className={buttonVariants({ size: "lg" })}>
            Try again
          </a>
        ) : (
          <Link
            href="/campus"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            Go to Campus
          </Link>
        )}
      </div>
    </main>
  );
}
