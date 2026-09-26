import { cn } from "cn";
import Link from "next/link";

import { GoogleSVG } from "@/assets/svgs/google";
import { buttonVariants } from "@/shared/ui/button";

export default function SignInPage() {
  return (
    <div className="flex flex-col items-center justify-center">
      <h1 className="font-display text-3xl font-bold">Sign in</h1>

      <Link
        href="/campus/1/join"
        className={cn(
          buttonVariants({ size: "lg", variant: "outline" }),
          "mt-6 min-w-72",
        )}
      >
        <GoogleSVG />
        Continue with Google
      </Link>
    </div>
  );
}
