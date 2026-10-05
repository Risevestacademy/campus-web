import type { Route } from "next";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";

import type { InviteProblem } from "../types/invite.types";
import { InviteProblemNotice } from "./invite-problem-notice";

const SIGN_IN_PATH: Route = "/sign-in";

// Called, not rendered as <Component />: the redirect must interrupt the read
// that found the 401, not wait for React to render a returned element.
// A 401 means the session ended, and sign-in renders for a visitor without one.
// It would loop only if /v1/auth/me accepted a session this route refused.
export function inviteReadProblem(
  problem: InviteProblem,
  retryHref: string,
): ReactElement {
  if (problem === "signed-out") redirect(SIGN_IN_PATH);
  return <InviteProblemNotice problem={problem} retryHref={retryHref} />;
}
