import {
  authErrorMessage,
  ForgetPreviousMember,
  parseReturnTo,
  redirectSignedInVisitor,
  SignInPanel,
} from "@/features/auth";
import { firstSearchParameter } from "@/shared/lib/search-params";

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
    <>
      <ForgetPreviousMember />
      <SignInPanel
        errorMessage={errorMessage}
        googleAuthHref={googleAuthHref}
      />
    </>
  );
}
