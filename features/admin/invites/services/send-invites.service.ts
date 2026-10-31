import type { ApiClient } from "@/core/api/client";

import type {
  InviteCreateProblem,
  InviteFailure,
  InviteRequest,
  InvitesSent,
} from "../types/invite.types";
import { createInvite } from "./invite-api.adapter";

// A problem with one address leaves the others to go. These problems are
// about the request as a whole, so the rest are not tried.
const STOPS_THE_REST: readonly InviteCreateProblem[] = [
  "forbidden",
  "rate-limited",
  "unavailable",
  "signed-out",
];

// One request per address, in turn: a failure names its address, and no burst
// of requests trips the rate limit.
export async function sendInvites(
  api: ApiClient,
  requests: readonly InviteRequest[],
): Promise<InvitesSent> {
  let sent = 0;
  let notEmailed = 0;
  const failures: InviteFailure[] = [];

  for (const [index, request] of requests.entries()) {
    const outcome = await createInvite(api, request);

    if (outcome.kind === "created") {
      sent += 1;
      if (!outcome.emailed) notEmailed += 1;
      continue;
    }
    // Nothing was created yet, so signing in again loses nothing. After that
    // the invites already made are reported, and the rest wait for a retry,
    // instead of being dropped by the sign-in redirect and refused as
    // duplicates.
    if (outcome.problem === "signed-out" && sent === 0) {
      return { kind: "signed-out" };
    }

    failures.push({ email: request.email, problem: outcome.problem });
    if (STOPS_THE_REST.includes(outcome.problem)) {
      for (const rest of requests.slice(index + 1)) {
        failures.push({ email: rest.email, problem: outcome.problem });
      }
      break;
    }
  }

  return { kind: "done", sent, notEmailed, failures };
}
