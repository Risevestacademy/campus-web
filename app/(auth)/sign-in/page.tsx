import { cn } from "cn";

import { GoogleSVG } from "@/assets/svgs/google";
import {
  authErrorMessage,
  parseReturnTo,
  redirectSignedInVisitor,
} from "@/features/auth";
import { firstSearchParameter } from "@/shared/lib/search-params";
import { buttonVariants } from "@/shared/ui/button";

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
  const returnTo = firstSearchParameter(query.returnTo);
  await redirectSignedInVisitor(returnTo);

  const errorMessage = authErrorMessage(firstSearchParameter(query.error));
  const googleAuthHref = createGoogleAuthHref(parseReturnTo(returnTo));

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
