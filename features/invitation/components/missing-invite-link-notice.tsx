"use client";

import { cn } from "cn";
import Link from "next/link";

import { buttonVariants } from "@/shared/ui/button";

import { useMissingInviteLinkShown } from "../hooks/use-missing-invite-link-shown";

export function MissingInviteLinkNotice() {
  useMissingInviteLinkShown();

  return (
    <div className="grid justify-items-center gap-6 text-center">
      <div className="grid max-w-md gap-2">
        <h1 className="font-display text-2xl font-bold">
          Open your invitation link.
        </h1>
        <p className="text-foreground-secondary">
          Open the link in your invitation email to continue. <br /> No
          invitation yet? Contact your Rise programme admin.
        </p>
      </div>
      <Link
        href="/"
        className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
      >
        Back to home
      </Link>
    </div>
  );
}
