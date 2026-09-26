import { cn } from "cn";
import Link from "next/link";

import { buttonVariants } from "@/shared/ui/button";

const inviteDetails = {
  invited_by: "Jerry",
  role: "student",
  cohort: "Product Design 2026",
};

export default function InvitationPage() {
  return (
    <div className="grid gap-6">
      <span className="text-foreground-secondary font-semibold tracking-wide uppercase">
        Campus Invitation
      </span>
      <h1 className="font-display text-3xl font-bold">
        You&apos;re invited to join Product Design Cohort 2026
      </h1>
      <p className="text-foreground-secondary text-lg leading-[160%] xl:pr-8">
        Campus by Rise is a shared virtual space for your cohort classes, mentor
        sessions and resources all live in one place. This invitation gives you
        a Student seat in this cohort; you&apos;ll set up your account on the
        next step.
      </p>

      <ul className="flex flex-wrap gap-4">
        {Object.entries(inviteDetails).map(([detail, value]) => (
          <li
            key={detail}
            className="flex h-8 w-fit min-w-40 items-center justify-center gap-1 rounded-full border px-3.5 text-sm font-medium tracking-wide capitalize"
          >
            {detail.replace("_", " ")} <span className="mx-0.5">•</span>
            {value}
          </li>
        ))}
      </ul>

      <Link
        href="/preview"
        className={cn(buttonVariants({ size: "lg" }), "mt-6 max-w-60")}
      >
        Continue
      </Link>
    </div>
  );
}
