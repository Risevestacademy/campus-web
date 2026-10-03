import { cn } from "cn";

import { GoogleSVG } from "@/assets/svgs/google";
import type { ApiClient } from "@/core/api/client";
import { buttonVariants } from "@/shared/ui/button";

import { previewInvite } from "../services/invite.service";
import type { InvitePreview } from "../types/invite.types";
import { GOOGLE_SIGN_IN_HREF } from "./google-sign-in";
import {
  chipText,
  cohortTitle,
  offerDetails,
  roleLabel,
} from "./invite-details";
import { inviteReadProblem } from "./invite-read-problem";

function offerHref(token: string): string {
  return `/invitation?${new URLSearchParams({ token }).toString()}`;
}

const CAMPUS_SUMMARY =
  "Campus by Rise is a shared virtual space for your cohort classes, mentor sessions and resources all live in one place.";

// Plain strings, not JSX text around {role}: the Next compiler dropped the
// space between an interpolated role and the text after it ("Studentseat").
function offerCopy(preview: InvitePreview) {
  const role = roleLabel(preview);
  const cohort = cohortTitle(preview);
  const grant = cohort
    ? `This invitation gives you a ${role} seat in this cohort`
    : `This invitation gives you ${role} access`;

  return {
    heading: cohort
      ? `You're invited to join ${cohort}`
      : "You're invited to Campus",
    body: `${CAMPUS_SUMMARY} ${grant}; you'll confirm your details after signing in.`,
  };
}

export async function InvitationOffer({
  api,
  token,
}: {
  api: ApiClient;
  token: string;
}) {
  const read = await previewInvite(api, token);
  if (read.kind === "problem") {
    return inviteReadProblem(read.problem, offerHref(token));
  }

  const { heading, body } = offerCopy(read.invite);

  return (
    <div className="grid gap-6">
      <span className="text-foreground-secondary font-semibold tracking-wide uppercase">
        Campus Invitation
      </span>
      <h1 className="font-display text-3xl font-bold text-balance">
        {heading}
      </h1>
      <p className="text-foreground-secondary text-lg leading-[160%] text-pretty xl:pr-8">
        {body}
      </p>

      <ul className="flex flex-wrap gap-4">
        {offerDetails(read.invite).map((detail) => (
          <li
            key={detail.label}
            className="flex h-8 w-fit items-center justify-center rounded-full border px-5 text-sm font-medium tracking-wide"
          >
            {chipText(detail)}
          </li>
        ))}
      </ul>

      {/* A plain anchor: OAuth must begin with a browser navigation. */}
      <a
        href={GOOGLE_SIGN_IN_HREF}
        className={cn(buttonVariants({ size: "lg" }), "mt-6 max-w-72")}
      >
        <GoogleSVG />
        Continue with Google
      </a>
    </div>
  );
}
