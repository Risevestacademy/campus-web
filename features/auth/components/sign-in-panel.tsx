import { cn } from "cn";
import Link from "next/link";

import { GoogleSVG } from "@/assets/svgs/google";
import { CampusLogo } from "@/assets/svgs/logo";
import { buttonVariants } from "@/shared/ui/button";

interface SignInPanelProps {
  errorMessage: string | undefined;
  googleAuthHref: string;
}

const homeLinkFocus =
  "outline-border-focus rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4";

export function SignInPanel({
  errorMessage,
  googleAuthHref,
}: SignInPanelProps) {
  return (
    <div className="relative flex flex-col items-center justify-center">
      <Link
        href="/"
        className={cn(
          "font-display mb-10 flex items-center gap-2 text-lg font-bold",
          homeLinkFocus,
        )}
      >
        <CampusLogo aria-hidden className="text-primary h-20 w-auto" />
        <span className="sr-only">Campus by Rise</span>
      </Link>

      <h1 className="font-display text-3xl font-bold">Sign in</h1>

      {errorMessage ? (
        <p role="alert" className="text-destructive mt-4 max-w-96 text-center">
          {errorMessage}
        </p>
      ) : null}

      <a
        href={googleAuthHref}
        className={cn(
          buttonVariants({ size: "lg", variant: "outline" }),
          "mt-6 min-w-72",
        )}
      >
        <GoogleSVG />
        Continue with Google
      </a>
      <p className="text-muted-foreground mt-4 max-w-96 text-center text-sm">
        Use the Google account your invite was sent to.
      </p>
    </div>
  );
}
