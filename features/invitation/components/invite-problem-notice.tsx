import { cn } from "cn";

import { GoogleSVG } from "@/assets/svgs/google";
import { buttonVariants } from "@/shared/ui/button";

import type { ExplainedInviteProblem } from "../types/invite.types";
import { GOOGLE_SIGN_IN_HREF } from "./google-sign-in";

const PROBLEM_COPY: Readonly<
  Record<ExplainedInviteProblem, { title: string; description: string }>
> = {
  expired: {
    title: "This invitation has expired",
    description:
      "Invitations only work for a limited time. Ask your Campus admin to send you a new one.",
  },
  "not-found": {
    title: "We couldn't find this invitation",
    description:
      "Check that you opened the full link from your invitation email, or ask your Campus admin for a new one.",
  },
  "already-accepted": {
    title: "You've already accepted this invitation",
    description: "Sign in with Google again to enter Campus.",
  },
  closed: {
    title: "This invitation is no longer active",
    description:
      "It was declined or withdrawn. Ask your Campus admin if you still need access.",
  },
  "already-member": {
    title: "You're already a member of this cohort",
    description:
      "This invitation can't change an existing membership. Your Campus admin will resolve it.",
  },
  unavailable: {
    title: "We couldn't load this invitation",
    description:
      "Campus can't reach the invitation service right now. Nothing has changed on your invitation.",
  },
};

interface InviteProblemNoticeProps {
  problem: ExplainedInviteProblem;
  // Where "Try again" reloads; only an unavailable read offers a retry.
  retryHref?: string;
  heading?: "h1" | "h2";
}

// Plain anchors, not next/link: OAuth must start with a browser navigation,
// and a retry must be a full request so the server read runs again.
function ProblemAction({
  problem,
  retryHref,
}: Pick<InviteProblemNoticeProps, "problem" | "retryHref">) {
  if (problem === "already-accepted") {
    return (
      <a
        href={GOOGLE_SIGN_IN_HREF}
        className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
      >
        <GoogleSVG />
        Continue with Google
      </a>
    );
  }
  if (problem === "unavailable" && retryHref) {
    return (
      <a href={retryHref} className={cn(buttonVariants({ size: "lg" }))}>
        Try again
      </a>
    );
  }
  return null;
}

export function InviteProblemNotice({
  problem,
  retryHref,
  heading: Heading = "h1",
}: InviteProblemNoticeProps) {
  const { title, description } = PROBLEM_COPY[problem];

  return (
    <div className="grid justify-items-start gap-6">
      <div role="alert" className="grid max-w-md gap-2">
        <Heading className="font-display text-2xl font-bold">{title}</Heading>
        <p className="text-foreground-secondary">{description}</p>
      </div>
      <ProblemAction problem={problem} retryHref={retryHref} />
    </div>
  );
}
