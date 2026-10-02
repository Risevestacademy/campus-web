import { cn } from "cn";

import { GoogleSVG } from "@/assets/svgs/google";
import { firstSearchParameter } from "@/shared/lib/search-params";
import { buttonVariants } from "@/shared/ui/button";

const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  account_suspended: "This account is currently suspended.",
  denied: "Google sign-in was cancelled.",
  exchange_failed: "Google sign-in could not be completed. Please try again.",
  expired_state: "Your sign-in attempt expired. Please try again.",
  incomplete_profile: "Your Google profile is missing required information.",
  invalid_request: "The sign-in request was invalid. Please try again.",
  invalid_state:
    "Your sign-in attempt could not be verified. Please try again.",
  invite_required: "You need an invitation to access Campus.",
  missing_code: "Google did not return a sign-in code. Please try again.",
  rate_limited: "Too many sign-in attempts. Please wait and try again.",
  server_error: "Sign-in is temporarily unavailable. Please try again.",
  session_expired: "Your session expired. Please sign in again.",
  unverified_email: "Verify your Google email address before signing in.",
};

const UNKNOWN_AUTH_ERROR = "Sign-in could not be completed. Please try again.";

interface SignInPageProps {
  searchParams: Promise<{
    error?: string | string[];
    returnTo?: string | string[];
  }>;
}

function createGoogleAuthHref(returnTo: string | undefined): string {
  if (!returnTo) return "/api/v1/auth/google";

  const search = new URLSearchParams({ returnTo });
  return `/api/v1/auth/google?${search.toString()}`;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const query = await searchParams;
  const errorCode = firstSearchParameter(query.error);
  const errorMessage = errorCode
    ? (AUTH_ERROR_MESSAGES[errorCode] ?? UNKNOWN_AUTH_ERROR)
    : undefined;
  const googleAuthHref = createGoogleAuthHref(
    firstSearchParameter(query.returnTo),
  );

  return (
    <div className="flex flex-col items-center justify-center">
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
    </div>
  );
}
